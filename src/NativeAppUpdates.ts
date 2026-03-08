import { TurboModuleRegistry, type TurboModule } from 'react-native';

export type NativeInstalledAppInfo = Readonly<{
  identifier: string;
  version: string;
  buildNumber: string | null;
}>;

export type NativePlayUpdateInfo = Readonly<{
  status: string;
  immediateAllowed: boolean;
  flexibleAllowed: boolean;
  availableVersionCode: number | null;
  clientVersionStalenessDays: number | null;
  updatePriority: number | null;
  errorCode: string | null;
  message: string | null;
}>;

export type NativeStartPlayUpdateResult = Readonly<{
  outcome: string;
  errorCode: string | null;
  message: string | null;
}>;

export type NativeOpenUrlResult = Readonly<{
  opened: boolean;
  errorCode: string | null;
  message: string | null;
}>;

export interface Spec extends TurboModule {
  getInstalledAppInfo(): Promise<NativeInstalledAppInfo>;
  getPlayUpdateInfo(): Promise<NativePlayUpdateInfo>;
  startPlayUpdate(
    flow: string,
    resumeInProgress: boolean
  ): Promise<NativeStartPlayUpdateResult>;
  openUrl(url: string): Promise<NativeOpenUrlResult>;
}

export default TurboModuleRegistry.get<Spec>('AppUpdates');
