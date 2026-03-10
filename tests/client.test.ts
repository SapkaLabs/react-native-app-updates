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

function success<T>(value: T): Promise<NativeResult<T>> {
  return Promise.resolve({ ok: true, value });
}

function failure(
  errorCode: string,
  message: string
): Promise<NativeResult<never>> {
  return Promise.resolve({ errorCode, message, ok: false });
}

function createFetchResponse(
  payload: unknown,
  ok = true,
  status = 200
): Response {
  return {
    json: async () => payload,
    ok,
    status,
  } as Response;
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
    ...overrides,
  };
}

function createEnvironment(
  platform: 'android' | 'ios',
  nativeAdapter: NativeAdapter,
  fetchFn: ClientEnvironment['fetchFn']
): ClientEnvironment {
  return {
    fetchFn,
    getPlatform: () => platform,
    nativeAdapter,
  };
}

function unexpectedFetch(): ClientEnvironment['fetchFn'] {
  return async () => {
    throw new Error('unexpected fetch');
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

function expectInvalidConfiguration(result: CheckResult) {
  expect(result.kind).toBe('invalidConfiguration');
  if (result.kind !== 'invalidConfiguration') {
    throw new Error(
      `Expected invalidConfiguration result, received ${result.kind}.`
    );
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
  test('appStore source checks versions and normalizes the country code', async () => {
    const calls: string[] = [];
    const fetchFn: ClientEnvironment['fetchFn'] = async (url) => {
      calls.push(String(url));
      return createFetchResponse({
        resultCount: 1,
        results: [
          {
            trackId: 123,
            version: '2.0.0',
          },
        ],
      });
    };

    const client = createInternalUpdateClient(
      {
        logging: { verbose: true },
        platforms: {
          ios: {
            source: sources.appStore({ country: 'US' }),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter(), fetchFn)
    );

    const result = expectUpdateAvailable(
      await client.checkForUpdate({ mode: 'versionCheckOnly' })
    );

    expect(result.availableVersion).toBe('2.0.0');
    expect(calls[0]).toContain('/us/lookup?bundleId=com.example.app');
  });

  test('appStore source omits the country segment when no country is configured', async () => {
    const calls: string[] = [];
    const fetchFn: ClientEnvironment['fetchFn'] = async (url) => {
      calls.push(String(url));
      return createFetchResponse({
        resultCount: 1,
        results: [
          {
            trackId: 123,
            version: '2.0.0',
          },
        ],
      });
    };

    const client = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.appStore(),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter(), fetchFn)
    );

    expectUpdateAvailable(
      await client.checkForUpdate({ mode: 'versionCheckOnly' })
    );
    expect(calls[0]).toBe(
      'https://itunes.apple.com/lookup?bundleId=com.example.app'
    );
  });

  test('recreating an iOS client does not reuse App Store lookup cache', async () => {
    let fetchCount = 0;
    const fetchFn: ClientEnvironment['fetchFn'] = async () => {
      fetchCount += 1;
      return createFetchResponse({
        resultCount: 1,
        results: [
          {
            trackId: 123,
            version: fetchCount === 1 ? '2.0.0' : '3.0.0',
          },
        ],
      });
    };

    const clientOne = createInternalUpdateClient(
      {
        platforms: {
          ios: {
            source: sources.appStore(),
          },
        },
      },
      createEnvironment('ios', createNativeAdapter(), fetchFn)
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
      createEnvironment('ios', createNativeAdapter(), fetchFn)
    );

    const secondResult = expectUpdateAvailable(
      await clientTwo.checkForUpdate({ mode: 'versionCheckOnly' })
    );
    expect(secondResult.availableVersion).toBe('3.0.0');
    expect(fetchCount).toBe(2);
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
      createEnvironment('ios', createNativeAdapter(), unexpectedFetch())
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
      createEnvironment('ios', createNativeAdapter(), unexpectedFetch())
    );

    const result = expectProviderError(
      await client.checkForUpdate({ mode: 'versionCheckOnly' })
    );
    expect(result.reason).toBe('invalidRemoteResponse');
  });

  test('official Play source rejects version overrides', async () => {
    const client = createInternalUpdateClient(
      {
        app: {
          versionOverride: '9.9.9',
        },
        platforms: {
          android: {
            source: sources.playStore(),
          },
        },
      },
      createEnvironment('android', createNativeAdapter(), unexpectedFetch())
    );

    const result = expectInvalidConfiguration(
      await client.checkForUpdate({ mode: 'versionCheckOnly' })
    );
    expect(result.reason).toBe('androidVersionOverrideNotSupported');
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
        }),
        unexpectedFetch()
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
        }),
        unexpectedFetch()
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
      createEnvironment('android', nativeAdapter, unexpectedFetch())
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
        }),
        unexpectedFetch()
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
        },
        unexpectedFetch()
      )
    );

    const result = expectUnsupported(
      await client.checkForUpdate({ mode: 'offerUpdateAllowed' })
    );
    expect(result.reason).toBe('nativeCapabilityUnavailable');
  });
});
