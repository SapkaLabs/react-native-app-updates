import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface NativeInstalledAppInfo {
  readonly buildNumber: string | null;
  readonly identifier: string;
  readonly version: string;
}

export interface NativePlayUpdateInfo {
  readonly availableVersionCode: number | null;
  readonly clientVersionStalenessDays: number | null;
  readonly errorCode: string | null;
  readonly flexibleAllowed: boolean;
  readonly immediateAllowed: boolean;
  readonly message: string | null;
  readonly status: string;
  readonly updatePriority: number | null;
}

interface ExampleNativeAppUpdatesSpec extends TurboModule {
  getInstalledAppInfo(): Promise<NativeInstalledAppInfo>;
  getPlayUpdateInfo(): Promise<NativePlayUpdateInfo>;
}

const NativeAppUpdates =
  TurboModuleRegistry.get<ExampleNativeAppUpdatesSpec>('AppUpdates') ?? null;

export async function readSystemAppInfo(): Promise<NativeInstalledAppInfo | null> {
  if (!NativeAppUpdates) {
    return null;
  }

  return NativeAppUpdates.getInstalledAppInfo();
}

export async function readPlayUpdateInfo(): Promise<NativePlayUpdateInfo | null> {
  if (!NativeAppUpdates) {
    return null;
  }

  return NativeAppUpdates.getPlayUpdateInfo();
}
