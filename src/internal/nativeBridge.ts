import type {
  NativeFakePlayStoreConfig,
  NativeFakePlayStoreState,
  NativeOpenUrlResult,
  NativePlayUpdateBackend,
  NativePlayUpdateInfo,
  NativeStartPlayUpdateResult,
  Spec,
} from '../NativeAppUpdates';

export interface NativeSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface NativeFailure {
  readonly errorCode: string;
  readonly message?: string;
  readonly ok: false;
}

export type NativeResult<T> = NativeFailure | NativeSuccess<T>;

export interface NativeAdapter {
  getInstalledAppInfo(): Promise<
    NativeResult<{
      buildNumber: string | null;
      identifier: string;
      version: string;
    }>
  >;
  getPlayUpdateInfo(
    backend: NativePlayUpdateBackend
  ): Promise<NativeResult<NativePlayUpdateInfo>>;
  openUrl(url: string): Promise<NativeResult<NativeOpenUrlResult>>;
  startPlayUpdate(
    flow: string,
    resumeInProgress: boolean,
    backend: NativePlayUpdateBackend
  ): Promise<NativeResult<NativeStartPlayUpdateResult>>;
  getFakePlayStoreState(): Promise<NativeResult<NativeFakePlayStoreState>>;
  resetFakePlayStore(): Promise<NativeResult<NativeFakePlayStoreState>>;
  configureFakePlayStoreState(
    config: NativeFakePlayStoreConfig
  ): Promise<NativeResult<NativeFakePlayStoreState>>;
  dispatchFakePlayStoreAction(
    action: string
  ): Promise<NativeResult<NativeFakePlayStoreState>>;
}

export function createNativeAdapter(module: Spec | null): NativeAdapter {
  return {
    async getInstalledAppInfo() {
      if (!module) {
        return {
          errorCode: 'native_module_unavailable',
          message: 'The AppUpdates TurboModule is not available.',
          ok: false,
        };
      }

      try {
        return {
          ok: true,
          value: await module.getInstalledAppInfo(),
        };
      } catch (error) {
        return {
          errorCode: 'native_exception',
          message: error instanceof Error ? error.message : String(error),
          ok: false,
        };
      }
    },

    async getPlayUpdateInfo(backend: NativePlayUpdateBackend) {
      if (!module) {
        return {
          errorCode: 'native_module_unavailable',
          message: 'The AppUpdates TurboModule is not available.',
          ok: false,
        };
      }

      try {
        return {
          ok: true,
          value: await module.getPlayUpdateInfo(backend),
        };
      } catch (error) {
        return {
          errorCode: 'native_exception',
          message: error instanceof Error ? error.message : String(error),
          ok: false,
        };
      }
    },

    async openUrl(url: string) {
      if (!module) {
        return {
          errorCode: 'native_module_unavailable',
          message: 'The AppUpdates TurboModule is not available.',
          ok: false,
        };
      }

      try {
        return {
          ok: true,
          value: await module.openUrl(url),
        };
      } catch (error) {
        return {
          errorCode: 'native_exception',
          message: error instanceof Error ? error.message : String(error),
          ok: false,
        };
      }
    },

    async startPlayUpdate(
      flow: string,
      resumeInProgress: boolean,
      backend: NativePlayUpdateBackend
    ) {
      if (!module) {
        return {
          errorCode: 'native_module_unavailable',
          message: 'The AppUpdates TurboModule is not available.',
          ok: false,
        };
      }

      try {
        return {
          ok: true,
          value: await module.startPlayUpdate(flow, resumeInProgress, backend),
        };
      } catch (error) {
        return {
          errorCode: 'native_exception',
          message: error instanceof Error ? error.message : String(error),
          ok: false,
        };
      }
    },

    async getFakePlayStoreState() {
      if (!module) {
        return {
          errorCode: 'native_module_unavailable',
          message: 'The AppUpdates TurboModule is not available.',
          ok: false,
        };
      }

      try {
        return {
          ok: true,
          value: await module.getFakePlayStoreState(),
        };
      } catch (error) {
        return {
          errorCode: 'native_exception',
          message: error instanceof Error ? error.message : String(error),
          ok: false,
        };
      }
    },

    async resetFakePlayStore() {
      if (!module) {
        return {
          errorCode: 'native_module_unavailable',
          message: 'The AppUpdates TurboModule is not available.',
          ok: false,
        };
      }

      try {
        return {
          ok: true,
          value: await module.resetFakePlayStore(),
        };
      } catch (error) {
        return {
          errorCode: 'native_exception',
          message: error instanceof Error ? error.message : String(error),
          ok: false,
        };
      }
    },

    async configureFakePlayStoreState(config: NativeFakePlayStoreConfig) {
      if (!module) {
        return {
          errorCode: 'native_module_unavailable',
          message: 'The AppUpdates TurboModule is not available.',
          ok: false,
        };
      }

      try {
        return {
          ok: true,
          value: await module.configureFakePlayStoreState(config),
        };
      } catch (error) {
        return {
          errorCode: 'native_exception',
          message: error instanceof Error ? error.message : String(error),
          ok: false,
        };
      }
    },

    async dispatchFakePlayStoreAction(action: string) {
      if (!module) {
        return {
          errorCode: 'native_module_unavailable',
          message: 'The AppUpdates TurboModule is not available.',
          ok: false,
        };
      }

      try {
        return {
          ok: true,
          value: await module.dispatchFakePlayStoreAction(action),
        };
      } catch (error) {
        return {
          errorCode: 'native_exception',
          message: error instanceof Error ? error.message : String(error),
          ok: false,
        };
      }
    },
  };
}
