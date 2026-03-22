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

export type NativePlayUpdateBackend = 'fake' | 'real';

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

export type NativeFakePlayStoreConfig = Readonly<{
  allowedUpdateTypes: ReadonlyArray<string>;
  availability: string;
  availableVersionCode: number | null;
  bytesDownloaded: number | null;
  clientVersionStalenessDays: number | null;
  installErrorCode: string | null;
  totalBytesToDownload: number | null;
  updatePriority: number | null;
}>;

export type NativeFakePlayStoreState = Readonly<{
  allowedUpdateTypes: ReadonlyArray<string>;
  availability: string;
  availableVersionCode: number | null;
  bytesDownloaded: number;
  clientVersionStalenessDays: number | null;
  installErrorCode: string | null;
  isConfirmationDialogVisible: boolean;
  isImmediateFlowVisible: boolean;
  isInstallSplashScreenVisible: boolean;
  totalBytesToDownload: number;
  updatePriority: number | null;
}>;

export interface Spec extends TurboModule {
  getInstalledAppInfo(): Promise<NativeInstalledAppInfo>;
  getPlayUpdateInfo(
    backend: NativePlayUpdateBackend
  ): Promise<NativePlayUpdateInfo>;
  startPlayUpdate(
    flow: string,
    resumeInProgress: boolean,
    backend: NativePlayUpdateBackend
  ): Promise<NativeStartPlayUpdateResult>;
  getFakePlayStoreState(): Promise<NativeFakePlayStoreState>;
  resetFakePlayStore(): Promise<NativeFakePlayStoreState>;
  configureFakePlayStoreState(
    config: NativeFakePlayStoreConfig
  ): Promise<NativeFakePlayStoreState>;
  dispatchFakePlayStoreAction(
    action: string
  ): Promise<NativeFakePlayStoreState>;
  openUrl(url: string): Promise<NativeOpenUrlResult>;
}

export default TurboModuleRegistry.get<Spec>('AppUpdates');
