import type {
  NativeOpenUrlResult,
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
  getPlayUpdateInfo(): Promise<NativeResult<NativePlayUpdateInfo>>;
  openUrl(url: string): Promise<NativeResult<NativeOpenUrlResult>>;
  startPlayUpdate(
    flow: string,
    resumeInProgress: boolean
  ): Promise<NativeResult<NativeStartPlayUpdateResult>>;
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

    async getPlayUpdateInfo() {
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
          value: await module.getPlayUpdateInfo(),
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

    async startPlayUpdate(flow: string, resumeInProgress: boolean) {
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
          value: await module.startPlayUpdate(flow, resumeInProgress),
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
