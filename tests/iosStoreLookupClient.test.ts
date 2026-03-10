import type { ILogger } from '../src/types';
import { IosStoreLookupClient } from '../src/internal/ios/IosStoreLookupClient';

function createLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

function createFetchResponse(payload: unknown): Response {
  return {
    json: async () => payload,
    ok: true,
    status: 200,
  } as Response;
}

describe('IosStoreLookupClient logging', () => {
  test('logs fetch context with an explicit country', async () => {
    const logger = createLogger();
    const fetchFn = jest.fn(async () =>
      createFetchResponse({
        resultCount: 1,
        results: [
          {
            trackId: 123,
            version: '2.0.0',
          },
        ],
      })
    );

    const client = new IosStoreLookupClient({
      bundleId: 'com.example.app',
      country: 'us',
      fetchFn: fetchFn as typeof fetch,
      logger,
    });

    await client.load();

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Fetching App Store metadata.', {
      bundleId: 'com.example.app',
      country: 'us',
      url: 'https://itunes.apple.com/us/lookup?bundleId=com.example.app',
    });
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('logs fetch context without a country override', async () => {
    const logger = createLogger();
    const fetchFn = jest.fn(async () =>
      createFetchResponse({
        resultCount: 1,
        results: [
          {
            trackId: 123,
            version: '2.0.0',
          },
        ],
      })
    );

    const client = new IosStoreLookupClient({
      bundleId: 'com.example.app',
      fetchFn: fetchFn as typeof fetch,
      logger,
    });

    await client.load();

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Fetching App Store metadata.', {
      bundleId: 'com.example.app',
      country: undefined,
      url: 'https://itunes.apple.com/lookup?bundleId=com.example.app',
    });
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
