import axios from 'axios';
import {
  createInternalUpdateClient,
  type ClientEnvironment,
} from '../src/internal/client';
import type { NativeAdapter, NativeResult } from '../src/internal/nativeBridge';
import { sources } from '../src/sources';
import { CheckResult, type PerformUpdateResult } from '../src/types';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    isAxiosError: jest.fn((value: unknown) =>
      Boolean(
        value &&
          typeof value === 'object' &&
          'isAxiosError' in value &&
          value.isAxiosError === true
      )
    ),
  },
}));

function success<T>(value: T): Promise<NativeResult<T>> {
  return Promise.resolve({ ok: true, value });
}

function failure(
  errorCode: string,
  message: string
): Promise<NativeResult<never>> {
  return Promise.resolve({ errorCode, message, ok: false });
}

function createAxiosResponse<T>(payload: T, status = 200) {
  return {
    data: payload,
    status,
  } as {
    data: T;
    status: number;
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

function createNativeAdapter(
  overrides: Partial<NativeAdapter> = {}
): NativeAdapter {
  return {
    getInstalledAppInfo: () =>
      success({
        buildNumber: '42',
        identifier: 'com.example.app',
        version: '1.0.0',
      }),
    getPlayUpdateInfo: () =>
      success({
        availableVersionCode: 99,
        clientVersionStalenessDays: null,
        errorCode: null,
        flexibleAllowed: true,
        immediateAllowed: true,
        message: null,
        status: 'update_available',
        updatePriority: 3,
      }),
    openUrl: (url: string) =>
      success({
        errorCode: null,
        message: null,
        opened: Boolean(url),
      }),
    startPlayUpdate: () =>
      success({
        errorCode: null,
        message: null,
        outcome: 'started',
      }),
    getFakePlayStoreState: () =>
      success({
        allowedUpdateTypes: ['flexible', 'immediate'],
        availability: 'available',
        availableVersionCode: 99,
        bytesDownloaded: 0,
        clientVersionStalenessDays: null,
        installErrorCode: null,
        isConfirmationDialogVisible: false,
        isImmediateFlowVisible: false,
        isInstallSplashScreenVisible: false,
        totalBytesToDownload: 1024,
        updatePriority: 3,
      }),
    resetFakePlayStore: () =>
      success({
        allowedUpdateTypes: [],
        availability: 'notAvailable',
        availableVersionCode: null,
        bytesDownloaded: 0,
        clientVersionStalenessDays: null,
        installErrorCode: null,
        isConfirmationDialogVisible: false,
        isImmediateFlowVisible: false,
        isInstallSplashScreenVisible: false,
        totalBytesToDownload: 0,
        updatePriority: null,
      }),
    configureFakePlayStoreState: () =>
      success({
        allowedUpdateTypes: ['flexible', 'immediate'],
        availability: 'available',
        availableVersionCode: 99,
        bytesDownloaded: 0,
        clientVersionStalenessDays: null,
        installErrorCode: null,
        isConfirmationDialogVisible: false,
        isImmediateFlowVisible: false,
        isInstallSplashScreenVisible: false,
        totalBytesToDownload: 1024,
        updatePriority: 3,
      }),
    dispatchFakePlayStoreAction: () =>
      success({
        allowedUpdateTypes: ['flexible', 'immediate'],
        availability: 'inProgress',
        availableVersionCode: 99,
        bytesDownloaded: 0,
        clientVersionStalenessDays: null,
        installErrorCode: null,
        isConfirmationDialogVisible: false,
        isImmediateFlowVisible: true,
        isInstallSplashScreenVisible: false,
        totalBytesToDownload: 1024,
        updatePriority: 3,
      }),
    ...overrides,
  };
}

function createEnvironment(
  platform: 'android' | 'ios',
  nativeAdapter: NativeAdapter
): ClientEnvironment {
  return {
    getPlatform: () => platform,
    nativeAdapter,
  };
}

function expectCheckResult(result: CheckResult): CheckResult {
  expect(result).toBeInstanceOf(CheckResult);
  return result;
}

function expectHasUpdates(
  result: CheckResult,
  canPerformUpdate: boolean
): CheckResult {
  const checkResult = expectCheckResult(result);
  expect(checkResult.status).toBe('hasUpdates');
  expect(checkResult.hasUpdates()).toBe(true);
  expect(checkResult.isError()).toBe(false);
  expect(checkResult.canPerformUpdate()).toBe(canPerformUpdate);
  return checkResult;
}

function expectNoUpdates(result: CheckResult): CheckResult {
  const checkResult = expectCheckResult(result);
  expect(checkResult.status).toBe('noUpdates');
  expect(checkResult.hasUpdates()).toBe(false);
  expect(checkResult.isError()).toBe(false);
  expect(checkResult.canPerformUpdate()).toBe(false);
  return checkResult;
}

function expectError(
  result: CheckResult,
  errorType: 'configuration' | 'provider' | 'unsupported'
): CheckResult {
  const checkResult = expectCheckResult(result);
  expect(checkResult.status).toBe('error');
  expect(checkResult.errorType).toBe(errorType);
  expect(checkResult.hasUpdates()).toBe(false);
  expect(checkResult.isError()).toBe(true);
  expect(checkResult.canPerformUpdate()).toBe(false);
  return checkResult;
}

function expectPublicCheckResultKeys(
  result: CheckResult,
  expectedKeys: readonly string[]
): void {
  expect(Object.keys(result).sort()).toEqual([...expectedKeys].sort());
  expect(Object.prototype.hasOwnProperty.call(result, 'actionable')).toBe(
    false
  );
}

function expectRedirected(result: PerformUpdateResult) {
  expect(result.kind).toBe('redirected');
  if (result.kind !== 'redirected') {
    throw new Error(`Expected redirected result, received ${result.kind}.`);
  }
  return result;
}

function expectStarted(result: PerformUpdateResult) {
  expect(result.kind).toBe('started');
  if (result.kind !== 'started') {
    throw new Error(`Expected started result, received ${result.kind}.`);
  }
  return result;
}

function expectFailed(result: PerformUpdateResult) {
  expect(result.kind).toBe('failed');
  if (result.kind !== 'failed') {
    throw new Error(`Expected failed result, received ${result.kind}.`);
  }
  return result;
}

describe('createInternalUpdateClient', () => {
  const mockedAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

  beforeEach(() => {
    mockedAxiosGet.mockReset();
  });

  test('appStore source checks versions and normalizes the country code', async () => {
    mockedAxiosGet.mockResolvedValueOnce(
      createAxiosResponse({
        resultCount: 1,
        results: [
          {
            trackId: 123,
            version: '2.0.0',
          },
        ],
      })
    );

    const client = createInternalUpdateClient(
      {
        debugging: { verbose: true },
        platforms: {
          ios: {
            source: sources.appStore({ country: 'US' }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    const result = expectHasUpdates(
      await client.checkForUpdate({ mode: 'versionCheckOnly' }),
      false
    );

    expect(result.currentVersion).toBe('1.0.0');
    expect(result.availableVersion).toBe('2.0.0');
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      'https://itunes.apple.com/us/lookup?bundleId=com.example.app'
    );
  });

  test('appStore source omits the country segment when no country is configured', async () => {
    mockedAxiosGet.mockResolvedValueOnce(
      createAxiosResponse({
        resultCount: 1,
        results: [
          {
            trackId: 123,
            version: '2.0.0',
          },
        ],
      })
    );

    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.appStore(),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    expectHasUpdates(
      await client.checkForUpdate({ mode: 'versionCheckOnly' }),
      false
    );
    expect(mockedAxiosGet).toHaveBeenCalledWith(
      'https://itunes.apple.com/lookup?bundleId=com.example.app'
    );
  });

  test('recreating an iOS client does not reuse App Store lookup cache', async () => {
    mockedAxiosGet
      .mockResolvedValueOnce(
        createAxiosResponse({
          resultCount: 1,
          results: [
            {
              trackId: 123,
              version: '2.0.0',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createAxiosResponse({
          resultCount: 1,
          results: [
            {
              trackId: 123,
              version: '3.0.0',
            },
          ],
        })
      );

    const clientOne = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.appStore(),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    const firstResult = expectHasUpdates(
      await clientOne.checkForUpdate({ mode: 'versionCheckOnly' }),
      false
    );
    expect(firstResult.availableVersion).toBe('2.0.0');

    const clientTwo = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.appStore(),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    const secondResult = expectHasUpdates(
      await clientTwo.checkForUpdate({ mode: 'versionCheckOnly' }),
      false
    );
    expect(secondResult.availableVersion).toBe('3.0.0');
    expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
  });

  test('offerUpdateAllowed stores a pending action and performUpdate uses it', async () => {
    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion: '1.1.0',
                  metadata: { channel: 'beta' },
                  targetUrl: 'https://example.com/download',
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    const result = expectHasUpdates(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      true
    );
    expect(result.availableVersion).toBe('1.1.0');

    const performResult = expectRedirected(await client.performUpdate());
    expect(performResult.targetUrl).toBe('https://example.com/download');
  });

  test('versionCheckOnly does not store a pending action', async () => {
    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion: '2.0.0',
                  targetUrl: 'https://example.com/download',
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    expectHasUpdates(
      await client.checkForUpdate({ mode: 'versionCheckOnly' }),
      false
    );

    const performResult = expectFailed(await client.performUpdate());
    expect(performResult.reason).toBe('invalidUpdateRequest');
    expect(performResult.message).toBe(
      'No pending update is stored on this client instance.'
    );
  });

  test('noUpdates clears a previously stored pending action', async () => {
    let latestVersion = '2.0.0';
    let targetUrl = 'https://example.com/first';
    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion,
                  targetUrl,
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    expectHasUpdates(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      true
    );

    latestVersion = '1.0.0';
    targetUrl = 'https://example.com/current';

    const noUpdateResult = expectNoUpdates(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' })
    );
    expect(noUpdateResult.currentVersion).toBe('1.0.0');
    expect(noUpdateResult.availableVersion).toBe('1.0.0');

    const performResult = expectFailed(await client.performUpdate());
    expect(performResult.reason).toBe('invalidUpdateRequest');
  });

  test('errors clear a previously stored pending action', async () => {
    let responseMode: 'valid' | 'invalid' = 'valid';
    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                if (responseMode === 'invalid') {
                  return {
                    latestVersion: '2.0.0',
                    targetUrl: 'not-a-url',
                  };
                }

                return {
                  latestVersion: '2.0.0',
                  targetUrl: 'https://example.com/download',
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    expectHasUpdates(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      true
    );

    responseMode = 'invalid';

    const errorResult = expectError(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      'provider'
    );
    expect(errorResult.errorMessage).toBe(
      'Custom providers must return an absolute targetUrl.'
    );

    const performResult = expectFailed(await client.performUpdate());
    expect(performResult.reason).toBe('invalidUpdateRequest');
  });

  test('a later actionable check replaces the stored pending action', async () => {
    const openUrlCalls: string[] = [];
    const targetUrls = [
      'https://example.com/first',
      'https://example.com/second',
    ];
    let callIndex = 0;

    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                const targetUrl =
                  targetUrls[Math.min(callIndex, targetUrls.length - 1)]!;
                callIndex += 1;
                return {
                  latestVersion: `2.${callIndex}.0`,
                  targetUrl,
                };
              },
            }),
          },
        },
      },
      createEnvironment(
        'ios',
        createNativeAdapter({
          openUrl: (url: string) => {
            openUrlCalls.push(url);
            return success({
              errorCode: null,
              message: null,
              opened: true,
            });
          },
        })
      )
    );

    expectHasUpdates(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      true
    );
    expectHasUpdates(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      true
    );

    const performResult = expectRedirected(await client.performUpdate());
    expect(performResult.targetUrl).toBe('https://example.com/second');
    expect(openUrlCalls).toEqual(['https://example.com/second']);
  });

  test('client instances do not share pending update state', async () => {
    const clientOne = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion: '2.0.0',
                  targetUrl: 'https://example.com/download',
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    const clientTwo = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion: '2.0.0',
                  targetUrl: 'https://example.com/download',
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    expectHasUpdates(
      await clientOne.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      true
    );

    const performResult = expectFailed(await clientTwo.performUpdate());
    expect(performResult.reason).toBe('invalidUpdateRequest');
  });

  test('CheckResult only exposes the intended public fields at runtime', async () => {
    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion: '2.0.0',
                  targetUrl: 'https://example.com/download',
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    const hasUpdatesResult = expectHasUpdates(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      true
    );
    expectPublicCheckResultKeys(hasUpdatesResult, [
      'availableVersion',
      'currentVersion',
      'status',
    ]);

    const noUpdatesClient = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion: '1.0.0',
                  targetUrl: 'https://example.com/download',
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    const noUpdatesResult = expectNoUpdates(
      await noUpdatesClient.checkForUpdate({ mode: 'versionCheckOnly' })
    );
    expectPublicCheckResultKeys(noUpdatesResult, [
      'availableVersion',
      'currentVersion',
      'status',
    ]);

    const errorClient = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion: '2.0.0',
                  targetUrl: 'not-a-url',
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    const errorResult = expectError(
      await errorClient.checkForUpdate({ mode: 'versionCheckOnly' }),
      'provider'
    );
    expectPublicCheckResultKeys(errorResult, [
      'errorMessage',
      'errorType',
      'status',
    ]);
  });

  test('reports unsupported when the runtime platform is unavailable', async () => {
    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion: '2.0.0',
                  targetUrl: 'https://example.com/download',
                };
              },
            }),
          },
        },
      },
      {
        getPlatform: () => null,
        nativeAdapter: createNativeAdapter(),
      }
    );

    const result = expectError(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      'unsupported'
    );
    expect(result.errorMessage).toBe(
      'The current runtime platform is not supported.'
    );
    expectPublicCheckResultKeys(result, [
      'errorMessage',
      'errorType',
      'status',
    ]);
  });

  test('android custom providers still receive debugging overrides', async () => {
    let receivedApp:
      | {
          readonly buildNumber?: string;
          readonly identifier: string;
          readonly version: string;
        }
      | undefined;

    const client = createInternalUpdateClient(
      {
        debugging: {
          identifierOverride: 'com.debug.override',
          versionOverride: '9.9.9',
        },
        platforms: {
          android: {
            source: sources.custom({
              async getLatestVersion(context) {
                receivedApp = context.app;
                return {
                  latestVersion: '10.0.0',
                  targetUrl: 'https://example.com/download',
                };
              },
            }),
          },
        },
      },
      createEnvironment('android', createNativeAdapter())
    );

    const result = expectHasUpdates(
      await client.checkForUpdate({ mode: 'versionCheckOnly' }),
      false
    );

    expect(receivedApp).toEqual({
      buildNumber: '42',
      identifier: 'com.debug.override',
      version: '9.9.9',
    });
    expect(result.currentVersion).toBe('9.9.9');
  });

  test('invalid custom provider payloads are surfaced as provider errors', async () => {
    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion: '2.0.0',
                  targetUrl: 'not-a-url',
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    const result = expectError(
      await client.checkForUpdate({ mode: 'versionCheckOnly' }),
      'provider'
    );
    expect(result.errorMessage).toBe(
      'Custom providers must return an absolute targetUrl.'
    );
  });

  test('appStore lookup failures are surfaced as provider errors', async () => {
    mockedAxiosGet.mockRejectedValueOnce(
      createAxiosError({
        code: 'ENOTFOUND',
        message: 'Network Error',
      })
    );

    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.appStore({
              retry: {
                baseDelayMs: 10,
                maxAttempts: 1,
              },
            }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter())
    );

    const result = expectError(
      await client.checkForUpdate({ mode: 'versionCheckOnly' }),
      'provider'
    );
    expect(result.errorMessage).toBe('Network Error');
  });

  test('official Play source ignores debugging overrides', async () => {
    const client = createInternalUpdateClient(
      {
        debugging: {
          identifierOverride: 'com.debug.override',
          versionOverride: '9.9.9',
        },
        platforms: {
          android: {
            source: sources.playStore(),
          },
        },
      },
      createEnvironment('android', createNativeAdapter())
    );

    const result = expectHasUpdates(
      await client.checkForUpdate({ mode: 'versionCheckOnly' }),
      false
    );
    expect(result.currentVersion).toBe('1.0.0');
  });

  test('fake Play source passes the fake backend to native checks and performs', async () => {
    const observedBackends: string[] = [];
    const nativeAdapter = createNativeAdapter({
      getPlayUpdateInfo: (backend) => {
        observedBackends.push(`check:${backend}`);
        return success({
          availableVersionCode: 120,
          clientVersionStalenessDays: 1,
          errorCode: null,
          flexibleAllowed: true,
          immediateAllowed: true,
          message: null,
          status: 'update_available',
          updatePriority: 4,
        });
      },
      startPlayUpdate: (flow, resumeInProgress, backend) => {
        observedBackends.push(`start:${backend}:${flow}:${resumeInProgress}`);
        return success({
          errorCode: null,
          message: null,
          outcome: 'started',
        });
      },
    });

    const client = createInternalUpdateClient(
      {
        platforms: {
          android: {
            source: sources.fakePlayStore({ flow: 'auto' }),
          },
        },
      },
      createEnvironment('android', nativeAdapter)
    );

    expectHasUpdates(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      true
    );

    const performResult = expectStarted(await client.performUpdate());
    expect(performResult.kind).toBe('started');
    expect(observedBackends).toEqual([
      'check:fake',
      'check:fake',
      'start:fake:flexible:false',
    ]);
  });

  test('Play source maps app-not-owned to unsupported errors', async () => {
    const client = createInternalUpdateClient(
      {
        platforms: {
          android: {
            source: sources.playStore(),
          },
        },
      },
      createEnvironment(
        'android',
        createNativeAdapter({
          getPlayUpdateInfo: () =>
            success({
              availableVersionCode: null,
              clientVersionStalenessDays: null,
              errorCode: 'app_not_owned',
              flexibleAllowed: false,
              immediateAllowed: false,
              message: 'App is not owned by any user on this device.',
              status: 'error',
              updatePriority: null,
            }),
        })
      )
    );

    const result = expectError(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      'unsupported'
    );
    expect(result.errorMessage).toBe(
      'App is not owned by any user on this device.'
    );
  });

  test('Play source maps install-not-allowed to unsupported errors', async () => {
    const client = createInternalUpdateClient(
      {
        platforms: {
          android: {
            source: sources.playStore(),
          },
        },
      },
      createEnvironment(
        'android',
        createNativeAdapter({
          getPlayUpdateInfo: () =>
            success({
              availableVersionCode: null,
              clientVersionStalenessDays: null,
              errorCode: 'install_not_allowed',
              flexibleAllowed: false,
              immediateAllowed: false,
              message:
                'Install Error(-6): The download/install is not allowed due to the current device state.',
              status: 'error',
              updatePriority: null,
            }),
        })
      )
    );

    const result = expectError(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      'unsupported'
    );
    expect(result.errorMessage).toContain('download/install is not allowed');
  });

  test('Play source supports developer-triggered immediate resume', async () => {
    const nativeAdapter = createNativeAdapter({
      getPlayUpdateInfo: () =>
        success({
          availableVersionCode: 100,
          clientVersionStalenessDays: 4,
          errorCode: null,
          flexibleAllowed: false,
          immediateAllowed: true,
          message: null,
          status: 'developer_triggered_update_in_progress',
          updatePriority: 5,
        }),
      startPlayUpdate: (flow: string, resumeInProgress: boolean) => {
        expect(flow).toBe('immediate');
        expect(resumeInProgress).toBe(true);
        return success({
          errorCode: null,
          message: null,
          outcome: 'started',
        });
      },
    });

    const client = createInternalUpdateClient(
      {
        platforms: {
          android: {
            source: sources.playStore({ flow: 'flexible' }),
          },
        },
      },
      createEnvironment('android', nativeAdapter)
    );

    expectHasUpdates(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      true
    );

    const performResult = expectStarted(await client.performUpdate());
    expect(performResult.kind).toBe('started');
  });

  test('Play source reports flow-specific unsupported errors', async () => {
    const client = createInternalUpdateClient(
      {
        platforms: {
          android: {
            source: sources.playStore({ flow: 'immediate' }),
          },
        },
      },
      createEnvironment(
        'android',
        createNativeAdapter({
          getPlayUpdateInfo: () =>
            success({
              availableVersionCode: 100,
              clientVersionStalenessDays: 2,
              errorCode: null,
              flexibleAllowed: true,
              immediateAllowed: false,
              message: null,
              status: 'update_available',
              updatePriority: 4,
            }),
        })
      )
    );

    const result = expectError(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      'unsupported'
    );
    expect(result.errorMessage).toContain('not currently allowed');
  });

  test('missing native capability does not crash the JS layer', async () => {
    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestVersion: '2.0.0',
                  targetUrl: 'https://example.com/download',
                };
              },
            }),
          },
        },
      },
      createEnvironment('ios', {
        getInstalledAppInfo: () =>
          failure('native_module_unavailable', 'missing native module'),
        getPlayUpdateInfo: () =>
          failure('native_module_unavailable', 'missing native module'),
        openUrl: () =>
          failure('native_module_unavailable', 'missing native module'),
        startPlayUpdate: () =>
          failure('native_module_unavailable', 'missing native module'),
        getFakePlayStoreState: () =>
          failure('native_module_unavailable', 'missing native module'),
        resetFakePlayStore: () =>
          failure('native_module_unavailable', 'missing native module'),
        configureFakePlayStoreState: () =>
          failure('native_module_unavailable', 'missing native module'),
        dispatchFakePlayStoreAction: () =>
          failure('native_module_unavailable', 'missing native module'),
      })
    );

    const result = expectError(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' }),
      'unsupported'
    );
    expect(result.errorMessage).toBe('missing native module');
  });
});
