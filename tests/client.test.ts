import axios from 'axios';
import {
  createInternalUpdateClient,
  type ClientEnvironment,
} from '../src/internal/client';
import type {
  CheckResult,
  PerformUpdateResult,
  UpdateAvailableResult,
} from '../src/types';
import type { NativeAdapter, NativeResult } from '../src/internal/nativeBridge';
import { sources } from '../src/sources';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    isAxiosError: jest.fn(
      (value: unknown) =>
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

function expectUpdateAvailable(
  result: CheckResult
): UpdateAvailableResult & { readonly kind: 'updateAvailable' } {
  expect(result.kind).toBe('updateAvailable');
  if (result.kind !== 'updateAvailable') {
    throw new Error(
      `Expected updateAvailable result, received ${result.kind}.`
    );
  }
  return result;
}

function expectOfferUpdateAvailable(
  result: CheckResult
): UpdateAvailableResult & {
  readonly kind: 'updateAvailable';
  readonly mode: 'offerUpdateAllowed';
} {
  const updateResult = expectUpdateAvailable(result);
  expect(updateResult.mode).toBe('offerUpdateAllowed');
  if (updateResult.mode !== 'offerUpdateAllowed') {
    throw new Error(
      `Expected offerUpdateAllowed mode, received ${updateResult.mode}.`
    );
  }
  return {
    ...updateResult,
    mode: 'offerUpdateAllowed',
  };
}

function expectUnsupported(result: CheckResult) {
  expect(result.kind).toBe('unsupported');
  if (result.kind !== 'unsupported') {
    throw new Error(`Expected unsupported result, received ${result.kind}.`);
  }
  return result;
}

function expectProviderError(result: CheckResult) {
  expect(result.kind).toBe('providerError');
  if (result.kind !== 'providerError') {
    throw new Error(`Expected providerError result, received ${result.kind}.`);
  }
  return result;
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

    const result = expectUpdateAvailable(
      await client.checkForUpdate({ mode: 'versionCheckOnly' })
    );

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

    expectUpdateAvailable(
      await client.checkForUpdate({ mode: 'versionCheckOnly' })
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

    const firstResult = expectUpdateAvailable(
      await clientOne.checkForUpdate({ mode: 'versionCheckOnly' })
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

    const secondResult = expectUpdateAvailable(
      await clientTwo.checkForUpdate({ mode: 'versionCheckOnly' })
    );
    expect(secondResult.availableVersion).toBe('3.0.0');
    expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
  });

  test('custom providers can return update metadata and redirect targets', async () => {
    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.custom({
              async getLatestVersion() {
                return {
                  latestBuildNumber: '7',
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

    const checkResult = expectOfferUpdateAvailable(
      await client.checkForUpdate({
        mode: 'offerUpdateAllowed',
      })
    );
    expect(checkResult.metadata).toEqual({ channel: 'beta' });
    expect(checkResult.targetUrl).toBe('https://example.com/download');

    const performResult = expectRedirected(
      await client.performUpdate(checkResult)
    );
    expect(performResult.targetUrl).toBe('https://example.com/download');
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

    const result = expectUpdateAvailable(
      await client.checkForUpdate({ mode: 'versionCheckOnly' })
    );

    expect(receivedApp).toEqual({
      buildNumber: '42',
      identifier: 'com.debug.override',
      version: '9.9.9',
    });
    expect(result.installedVersion).toBe('9.9.9');
  });

  test('invalid custom provider payloads are surfaced as providerError', async () => {
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

    const result = expectProviderError(
      await client.checkForUpdate({ mode: 'versionCheckOnly' })
    );
    expect(result.reason).toBe('invalidRemoteResponse');
  });

  test('appStore provider errors expose typed network error details', async () => {
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

    const result = expectProviderError(
      await client.checkForUpdate({ mode: 'versionCheckOnly' })
    );

    expect(result.reason).toBe('lookupFailed');
    expect(result.message).toBe('Network Error');
    expect(result.error).toEqual({
      code: 'ENOTFOUND',
      message: 'Network Error',
      retryable: true,
      type: 'network',
    });
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

    const result = expectUpdateAvailable(
      await client.checkForUpdate({ mode: 'versionCheckOnly' })
    );
    expect(result.installedVersion).toBe('1.0.0');
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

    const checkResult = expectOfferUpdateAvailable(
      await client.checkForUpdate({
        mode: 'offerUpdateAllowed',
      })
    );

    const performResult = expectStarted(
      await client.performUpdate(checkResult)
    );

    expect(performResult.kind).toBe('started');
    expect(observedBackends).toEqual([
      'check:fake',
      'check:fake',
      'start:fake:flexible:false',
    ]);
  });

  test('Play source maps app-not-owned to unsupported', async () => {
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

    const result = expectUnsupported(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' })
    );
    expect(result.reason).toBe('androidAppNotOwned');
  });

  test('Play source maps install-not-allowed to unsupported', async () => {
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

    const result = expectUnsupported(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' })
    );
    expect(result.reason).toBe('androidInstallNotAllowed');
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

    const checkResult = expectOfferUpdateAvailable(
      await client.checkForUpdate({
        mode: 'offerUpdateAllowed',
      })
    );

    const performResult = expectStarted(
      await client.performUpdate(checkResult)
    );
    expect(performResult.kind).toBe('started');
  });

  test('Play source reports flow-specific unsupported results', async () => {
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

    const result = expectUnsupported(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' })
    );
    expect(result.reason).toBe('playFlowNotAllowed');
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
      createEnvironment(
        'ios',
        {
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
        }
      )
    );

    const result = expectUnsupported(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' })
    );
    expect(result.reason).toBe('nativeCapabilityUnavailable');
  });
});
