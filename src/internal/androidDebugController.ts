import type {
  NativeFakePlayStoreConfig,
  NativeFakePlayStoreState,
} from '../NativeAppUpdates';
import type { NativeAdapter } from './nativeBridge';
import type {
  AndroidFakeInstallErrorCode,
  AndroidFakePlayStoreAction,
  AndroidFakePlayStoreConfig,
  AndroidFakePlayStoreController,
  AndroidFakePlayStoreDebugResult,
  AndroidFakePlayStoreState,
  AndroidFakePlayStoreStateAvailability,
  PlatformName,
} from '../types';

export function createAndroidFakePlayStoreController(
  nativeAdapter: NativeAdapter,
  getPlatform: () => PlatformName | null
): AndroidFakePlayStoreController {
  return Object.freeze({
    async configureState(
      options: AndroidFakePlayStoreConfig
    ): Promise<AndroidFakePlayStoreDebugResult<AndroidFakePlayStoreState>> {
      if (getPlatform() !== 'android') {
        return createUnsupportedResult(
          'runtimePlatformUnsupported',
          'Fake Play Store controls are only available on Android.'
        );
      }

      const nativeResult = await nativeAdapter.configureFakePlayStoreState(
        createNativeConfig(options)
      );

      return toControllerResult(nativeResult);
    },

    async dispatch(
      action: AndroidFakePlayStoreAction
    ): Promise<AndroidFakePlayStoreDebugResult<AndroidFakePlayStoreState>> {
      if (getPlatform() !== 'android') {
        return createUnsupportedResult(
          'runtimePlatformUnsupported',
          'Fake Play Store controls are only available on Android.'
        );
      }

      const nativeResult = await nativeAdapter.dispatchFakePlayStoreAction(
        action
      );

      return toControllerResult(nativeResult);
    },

    async getState(): Promise<
      AndroidFakePlayStoreDebugResult<AndroidFakePlayStoreState>
    > {
      if (getPlatform() !== 'android') {
        return createUnsupportedResult(
          'runtimePlatformUnsupported',
          'Fake Play Store controls are only available on Android.'
        );
      }

      const nativeResult = await nativeAdapter.getFakePlayStoreState();
      return toControllerResult(nativeResult);
    },

    async reset(): Promise<
      AndroidFakePlayStoreDebugResult<AndroidFakePlayStoreState>
    > {
      if (getPlatform() !== 'android') {
        return createUnsupportedResult(
          'runtimePlatformUnsupported',
          'Fake Play Store controls are only available on Android.'
        );
      }

      const nativeResult = await nativeAdapter.resetFakePlayStore();
      return toControllerResult(nativeResult);
    },
  });
}

function createNativeConfig(
  options: AndroidFakePlayStoreConfig
): NativeFakePlayStoreConfig {
  return {
    allowedUpdateTypes: options.allowedUpdateTypes
      ? [...options.allowedUpdateTypes]
      : [],
    availability: options.availability,
    availableVersionCode:
      options.availability === 'available'
        ? options.availableVersionCode
        : null,
    bytesDownloaded: options.bytesDownloaded ?? null,
    clientVersionStalenessDays: options.clientVersionStalenessDays ?? null,
    installErrorCode: options.installErrorCode ?? null,
    totalBytesToDownload: options.totalBytesToDownload ?? null,
    updatePriority: options.updatePriority ?? null,
  };
}

function createUnsupportedResult<T>(
  reason: 'nativeCapabilityUnavailable' | 'runtimePlatformUnsupported',
  message?: string
): AndroidFakePlayStoreDebugResult<T> {
  return {
    kind: 'unsupported',
    message,
    reason,
  };
}

function mapAvailability(
  availability: string
): AndroidFakePlayStoreStateAvailability {
  return isFakePlayStoreStateAvailability(availability)
    ? availability
    : 'notAvailable';
}

function mapAllowedUpdateTypes(
  allowedUpdateTypes: readonly string[]
): readonly ('flexible' | 'immediate')[] {
  return allowedUpdateTypes.filter(
    (value): value is 'flexible' | 'immediate' =>
      value === 'flexible' || value === 'immediate'
  );
}

function mapInstallErrorCode(
  value: string | null
): AndroidFakeInstallErrorCode | null {
  if (value && isAndroidFakeInstallErrorCode(value)) {
    return value;
  }

  return null;
}

function isAndroidFakeInstallErrorCode(
  value: string
): value is AndroidFakeInstallErrorCode {
  return (
    value === 'app_not_owned' ||
    value === 'app_update_api_not_available' ||
    value === 'download_not_present' ||
    value === 'install_not_allowed' ||
    value === 'internal_error' ||
    value === 'play_store_not_found' ||
    value === 'unknown_error'
  );
}

function isFakePlayStoreStateAvailability(
  value: string
): value is AndroidFakePlayStoreStateAvailability {
  return (
    value === 'available' || value === 'inProgress' || value === 'notAvailable'
  );
}

function mapState(state: NativeFakePlayStoreState): AndroidFakePlayStoreState {
  return {
    allowedUpdateTypes: mapAllowedUpdateTypes(state.allowedUpdateTypes),
    availability: mapAvailability(state.availability),
    availableVersionCode: state.availableVersionCode,
    bytesDownloaded: state.bytesDownloaded,
    clientVersionStalenessDays: state.clientVersionStalenessDays,
    installErrorCode: mapInstallErrorCode(state.installErrorCode),
    isConfirmationDialogVisible: state.isConfirmationDialogVisible,
    isImmediateFlowVisible: state.isImmediateFlowVisible,
    isInstallSplashScreenVisible: state.isInstallSplashScreenVisible,
    totalBytesToDownload: state.totalBytesToDownload,
    updatePriority: state.updatePriority,
  };
}

function toControllerResult(
  nativeResult:
    | Awaited<ReturnType<NativeAdapter['configureFakePlayStoreState']>>
    | Awaited<ReturnType<NativeAdapter['dispatchFakePlayStoreAction']>>
    | Awaited<ReturnType<NativeAdapter['getFakePlayStoreState']>>
    | Awaited<ReturnType<NativeAdapter['resetFakePlayStore']>>
): AndroidFakePlayStoreDebugResult<AndroidFakePlayStoreState> {
  if (!nativeResult.ok) {
    return createUnsupportedResult(
      'nativeCapabilityUnavailable',
      nativeResult.message
    );
  }

  return {
    kind: 'ok',
    value: mapState(nativeResult.value),
  };
}
