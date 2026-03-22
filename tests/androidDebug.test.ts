import { createAndroidFakePlayStoreController } from '../src/internal/androidDebugController';
import type { NativeAdapter, NativeResult } from '../src/internal/nativeBridge';

function success<T>(value: T): Promise<NativeResult<T>> {
  return Promise.resolve({ ok: true, value });
}

function failure(
  errorCode: string,
  message: string
): Promise<NativeResult<never>> {
  return Promise.resolve({ errorCode, message, ok: false });
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
    openUrl: () =>
      success({
        errorCode: null,
        message: null,
        opened: true,
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
        availableVersionCode: 150,
        bytesDownloaded: 32,
        clientVersionStalenessDays: 3,
        installErrorCode: 'install_not_allowed',
        isConfirmationDialogVisible: false,
        isImmediateFlowVisible: true,
        isInstallSplashScreenVisible: false,
        totalBytesToDownload: 128,
        updatePriority: 5,
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
        allowedUpdateTypes: ['flexible'],
        availability: 'available',
        availableVersionCode: 222,
        bytesDownloaded: 0,
        clientVersionStalenessDays: 1,
        installErrorCode: null,
        isConfirmationDialogVisible: false,
        isImmediateFlowVisible: false,
        isInstallSplashScreenVisible: false,
        totalBytesToDownload: 512,
        updatePriority: 4,
      }),
    dispatchFakePlayStoreAction: () =>
      success({
        allowedUpdateTypes: ['flexible'],
        availability: 'inProgress',
        availableVersionCode: 222,
        bytesDownloaded: 128,
        clientVersionStalenessDays: 1,
        installErrorCode: null,
        isConfirmationDialogVisible: false,
        isImmediateFlowVisible: false,
        isInstallSplashScreenVisible: true,
        totalBytesToDownload: 512,
        updatePriority: 4,
      }),
    ...overrides,
  };
}

describe('createAndroidFakePlayStoreController', () => {
  test('returns runtime unsupported results outside Android', async () => {
    const controller = createAndroidFakePlayStoreController(
      createNativeAdapter(),
      () => 'ios'
    );

    const result = await controller.getState();

    expect(result).toEqual({
      kind: 'unsupported',
      message: 'Fake Play Store controls are only available on Android.',
      reason: 'runtimePlatformUnsupported',
    });
  });

  test('maps native failures without throwing', async () => {
    const controller = createAndroidFakePlayStoreController(
      createNativeAdapter({
        getFakePlayStoreState: () =>
          failure('native_module_unavailable', 'missing native module'),
      }),
      () => 'android'
    );

    const result = await controller.getState();

    expect(result).toEqual({
      kind: 'unsupported',
      message: 'missing native module',
      reason: 'nativeCapabilityUnavailable',
    });
  });

  test('forwards configureState to native and normalizes the returned state', async () => {
    const calls: unknown[] = [];
    const controller = createAndroidFakePlayStoreController(
      createNativeAdapter({
        configureFakePlayStoreState: (config) => {
          calls.push(config);
          return success({
            allowedUpdateTypes: ['flexible', 'unexpected'],
            availability: 'available',
            availableVersionCode: 321,
            bytesDownloaded: 64,
            clientVersionStalenessDays: 2,
            installErrorCode: 'install_not_allowed',
            isConfirmationDialogVisible: true,
            isImmediateFlowVisible: false,
            isInstallSplashScreenVisible: false,
            totalBytesToDownload: 256,
            updatePriority: 5,
          });
        },
      }),
      () => 'android'
    );

    const result = await controller.configureState({
      allowedUpdateTypes: ['flexible'],
      availability: 'available',
      availableVersionCode: 321,
      bytesDownloaded: 64,
      clientVersionStalenessDays: 2,
      installErrorCode: 'install_not_allowed',
      totalBytesToDownload: 256,
      updatePriority: 5,
    });

    expect(calls).toEqual([
      {
        allowedUpdateTypes: ['flexible'],
        availability: 'available',
        availableVersionCode: 321,
        bytesDownloaded: 64,
        clientVersionStalenessDays: 2,
        installErrorCode: 'install_not_allowed',
        totalBytesToDownload: 256,
        updatePriority: 5,
      },
    ]);
    expect(result).toEqual({
      kind: 'ok',
      value: {
        allowedUpdateTypes: ['flexible'],
        availability: 'available',
        availableVersionCode: 321,
        bytesDownloaded: 64,
        clientVersionStalenessDays: 2,
        installErrorCode: 'install_not_allowed',
        isConfirmationDialogVisible: true,
        isImmediateFlowVisible: false,
        isInstallSplashScreenVisible: false,
        totalBytesToDownload: 256,
        updatePriority: 5,
      },
    });
  });
});
