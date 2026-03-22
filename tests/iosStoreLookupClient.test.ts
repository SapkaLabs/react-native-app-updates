import type { ILogger } from '../src/types';
import {
  AppStoreLookupFailure,
  IosStoreLookupClient,
} from '../src/internal/ios/IosStoreLookupClient';

function createLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

function createAxiosError(options: {
  code?: string;
  message: string;
  status?: number;
}): Error & {
  code?: string;
  isAxiosError: true;
  response?: {
    status: number;
  };
} {
  const error = new Error(options.message) as Error & {
    code?: string;
    isAxiosError: true;
    response?: {
      status: number;
    };
  };
  error.code = options.code;
  error.isAxiosError = true;
  if (options.status !== undefined) {
    error.response = {
      status: options.status,
    };
  }
  return error;
}

async function expectLookupFailure(
  promise: Promise<unknown>
): Promise<AppStoreLookupFailure> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppStoreLookupFailure);
    if (!(error instanceof AppStoreLookupFailure)) {
      throw error;
    }

    return error;
  }

  throw new Error('Expected AppStoreLookupFailure to be thrown.');
}

describe('IosStoreLookupClient', () => {
  test('loads metadata through the axios-compatible client', async () => {
    const logger = createLogger();
    const httpClient = {
      get: jest.fn(async () => ({
        data: {
          resultCount: 1,
          results: [
            {
              trackId: 123,
              version: '2.0.0',
            },
          ],
        },
        status: 200,
      })),
    };

    const client = new IosStoreLookupClient({
      bundleId: 'com.example.app',
      country: 'us',
      httpClient,
      logger,
    });

    const result = await client.load();

    expect(result).toEqual({
      bundleId: 'com.example.app',
      country: 'us',
      storeUrl: 'itms-apps://apps.apple.com/us/app/id123',
      version: '2.0.0',
    });
    expect(httpClient.get).toHaveBeenCalledWith(
      'https://itunes.apple.com/us/lookup?bundleId=com.example.app'
    );
    expect(logger.debug).toHaveBeenCalledWith('Fetching App Store metadata.', {
      bundleId: 'com.example.app',
      country: 'us',
      url: 'https://itunes.apple.com/us/lookup?bundleId=com.example.app',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('retries transient network failures until a later attempt succeeds', async () => {
    const logger = createLogger();
    const sleep = jest.fn(async () => undefined);
    const httpClient = {
      get: jest
        .fn()
        .mockRejectedValueOnce(
          createAxiosError({
            code: 'ECONNRESET',
            message: 'socket hang up',
          })
        )
        .mockResolvedValueOnce({
          data: {
            resultCount: 1,
            results: [
              {
                trackId: 321,
                version: '2.1.0',
              },
            ],
          },
          status: 200,
        }),
    };

    const client = new IosStoreLookupClient({
      bundleId: 'com.example.app',
      httpClient,
      logger,
      retry: {
        baseDelayMs: 250,
        maxAttempts: 3,
      },
      sleep,
    });

    const result = await client.load();

    expect(result.version).toBe('2.1.0');
    expect(httpClient.get).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(250);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('uses stepped delays and fails after the configured max attempts', async () => {
    const logger = createLogger();
    const sleep = jest.fn(async () => undefined);
    const httpClient = {
      get: jest.fn().mockRejectedValue(
        createAxiosError({
          code: 'ENOTFOUND',
          message: 'Network Error',
        })
      ),
    };

    const client = new IosStoreLookupClient({
      bundleId: 'com.example.app',
      httpClient,
      logger,
      sleep,
    });

    const failure = await expectLookupFailure(client.load());

    expect(httpClient.get).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls).toEqual([[3000], [6000]]);
    expect(failure.reason).toBe('lookupFailed');
    expect(failure.attemptCount).toBe(3);
    expect(failure.details).toEqual({
      code: 'ENOTFOUND',
      message: 'Network Error',
      retryable: true,
      type: 'network',
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test('does not retry HTTP failures and classifies them as system errors', async () => {
    const logger = createLogger();
    const sleep = jest.fn(async () => undefined);
    const httpClient = {
      get: jest.fn().mockRejectedValue(
        createAxiosError({
          message: 'Request failed with status code 500',
          status: 500,
        })
      ),
    };

    const client = new IosStoreLookupClient({
      bundleId: 'com.example.app',
      httpClient,
      logger,
      sleep,
    });

    const failure = await expectLookupFailure(client.load());

    expect(httpClient.get).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(failure.reason).toBe('lookupFailed');
    expect(failure.attemptCount).toBe(1);
    expect(failure.details).toEqual({
      code: undefined,
      message: 'App Store lookup failed with status 500.',
      retryable: false,
      status: 500,
      type: 'system',
    });
  });

  test('does not retry invalid or empty App Store payloads', async () => {
    const logger = createLogger();
    const sleep = jest.fn(async () => undefined);
    const httpClient = {
      get: jest.fn().mockResolvedValue({
        data: {
          resultCount: 0,
          results: [],
        },
        status: 200,
      }),
    };

    const client = new IosStoreLookupClient({
      bundleId: 'com.example.app',
      httpClient,
      logger,
      sleep,
    });

    const failure = await expectLookupFailure(client.load());

    expect(httpClient.get).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(failure.reason).toBe('invalidRemoteResponse');
    expect(failure.attemptCount).toBe(1);
    expect(failure.details).toEqual({
      message: 'App Store lookup did not return any results.',
      retryable: false,
      type: 'system',
    });
  });

  test('maps unexpected thrown errors to the unknown error type', async () => {
    const logger = createLogger();
    const sleep = jest.fn(async () => undefined);
    const httpClient = {
      get: jest.fn().mockRejectedValue(new Error('boom')),
    };

    const client = new IosStoreLookupClient({
      bundleId: 'com.example.app',
      httpClient,
      logger,
      sleep,
    });

    const failure = await expectLookupFailure(client.load());

    expect(httpClient.get).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(failure.reason).toBe('lookupFailed');
    expect(failure.attemptCount).toBe(1);
    expect(failure.details).toEqual({
      message: 'boom',
      retryable: false,
      type: 'unknown',
    });
  });
});
