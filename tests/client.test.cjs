const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createInternalUpdateClient,
} = require('../.test-dist/src/internal/client.js');
const { sources } = require('../.test-dist/src/sources.js');

function success(value) {
  return Promise.resolve({ ok: true, value });
}

function failure(errorCode, message) {
  return Promise.resolve({ errorCode, message, ok: false });
}

function createNativeAdapter(overrides = {}) {
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
    openUrl: (url) =>
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

function createEnvironment(platform, nativeAdapter, fetchFn) {
  return {
    fetchFn,
    getPlatform: () => platform,
    nativeAdapter,
  };
}

test('appStore source checks versions and normalizes the country code', async () => {
  const calls = [];
  const client = createInternalUpdateClient(
    {
      logging: { verbose: true },
      platforms: {
        ios: {
          source: sources.appStore({ country: 'US' }),
        },
      },
    },
    createEnvironment('ios', createNativeAdapter(), async (url) => {
      calls.push(url);
      return {
        json: async () => ({
          resultCount: 1,
          results: [
            {
              trackId: 123,
              version: '2.0.0',
            },
          ],
        }),
        ok: true,
      };
    })
  );

  const result = await client.checkForUpdate({ mode: 'versionCheckOnly' });

  assert.equal(result.kind, 'updateAvailable');
  assert.equal(result.availableVersion, '2.0.0');
  assert.equal(calls[0].includes('/us/lookup?bundleId=com.example.app'), true);
});

test('appStore source omits the country segment when no country is configured', async () => {
  const calls = [];
  const client = createInternalUpdateClient(
    {
      platforms: {
        ios: {
          source: sources.appStore(),
        },
      },
    },
    createEnvironment('ios', createNativeAdapter(), async (url) => {
      calls.push(url);
      return {
        json: async () => ({
          resultCount: 1,
          results: [
            {
              trackId: 123,
              version: '2.0.0',
            },
          ],
        }),
        ok: true,
      };
    })
  );

  const result = await client.checkForUpdate({ mode: 'versionCheckOnly' });

  assert.equal(result.kind, 'updateAvailable');
  assert.equal(calls[0], 'https://itunes.apple.com/lookup?bundleId=com.example.app');
});

test('recreating an iOS client does not reuse App Store lookup cache', async () => {
  let fetchCount = 0;
  const fetchFn = async () => {
    fetchCount += 1;
    return {
      json: async () => ({
        resultCount: 1,
        results: [
          {
            trackId: 123,
            version: fetchCount === 1 ? '2.0.0' : '3.0.0',
          },
        ],
      }),
      ok: true,
    };
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

  const firstResult = await clientOne.checkForUpdate({ mode: 'versionCheckOnly' });
  assert.equal(firstResult.kind, 'updateAvailable');
  assert.equal(firstResult.availableVersion, '2.0.0');

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

  const secondResult = await clientTwo.checkForUpdate({ mode: 'versionCheckOnly' });
  assert.equal(secondResult.kind, 'updateAvailable');
  assert.equal(secondResult.availableVersion, '3.0.0');
  assert.equal(fetchCount, 2);
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
    createEnvironment('ios', createNativeAdapter(), async () => {
      throw new Error('unexpected fetch');
    })
  );

  const checkResult = await client.checkForUpdate({
    mode: 'offerUpdateAllowed',
  });
  assert.equal(checkResult.kind, 'updateAvailable');
  assert.deepEqual(checkResult.metadata, { channel: 'beta' });
  assert.equal(checkResult.targetUrl, 'https://example.com/download');

  const performResult = await client.performUpdate(checkResult);
  assert.equal(performResult.kind, 'redirected');
  assert.equal(performResult.targetUrl, 'https://example.com/download');
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
    createEnvironment('ios', createNativeAdapter(), async () => {
      throw new Error('unexpected fetch');
    })
  );

  const result = await client.checkForUpdate({ mode: 'versionCheckOnly' });
  assert.equal(result.kind, 'providerError');
  assert.equal(result.reason, 'invalidRemoteResponse');
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
    createEnvironment('android', createNativeAdapter(), async () => {
      throw new Error('unexpected fetch');
    })
  );

  const result = await client.checkForUpdate({ mode: 'versionCheckOnly' });
  assert.equal(result.kind, 'invalidConfiguration');
  assert.equal(result.reason, 'androidVersionOverrideNotSupported');
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
      async () => {
        throw new Error('unexpected fetch');
      }
    )
  );

  const result = await client.checkForUpdate({ mode: 'offerUpdateAllowed' });
  assert.equal(result.kind, 'unsupported');
  assert.equal(result.reason, 'androidAppNotOwned');
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
      async () => {
        throw new Error('unexpected fetch');
      }
    )
  );

  const result = await client.checkForUpdate({ mode: 'offerUpdateAllowed' });
  assert.equal(result.kind, 'unsupported');
  assert.equal(result.reason, 'androidInstallNotAllowed');
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
    startPlayUpdate: (flow, resumeInProgress) => {
      assert.equal(flow, 'immediate');
      assert.equal(resumeInProgress, true);
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
    createEnvironment('android', nativeAdapter, async () => {
      throw new Error('unexpected fetch');
    })
  );

  const checkResult = await client.checkForUpdate({
    mode: 'offerUpdateAllowed',
  });
  assert.equal(checkResult.kind, 'updateAvailable');

  const performResult = await client.performUpdate(checkResult);
  assert.equal(performResult.kind, 'started');
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
      async () => {
        throw new Error('unexpected fetch');
      }
    )
  );

  const result = await client.checkForUpdate({ mode: 'offerUpdateAllowed' });
  assert.equal(result.kind, 'unsupported');
  assert.equal(result.reason, 'playFlowNotAllowed');
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
      async () => {
        throw new Error('unexpected fetch');
      }
    )
  );

  const result = await client.checkForUpdate({ mode: 'offerUpdateAllowed' });
  assert.equal(result.kind, 'unsupported');
  assert.equal(result.reason, 'nativeCapabilityUnavailable');
});
