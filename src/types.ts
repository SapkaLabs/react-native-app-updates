export type PlatformName = 'android' | 'ios';
export type SourceType = 'appStore' | 'custom' | 'playStore';
export type CheckMode = 'offerUpdateAllowed' | 'versionCheckOnly';
export type PlayStoreFlow = 'auto' | 'flexible' | 'immediate';
export type UpdateMetadata = Readonly<Record<string, unknown>>;
export type AndroidFakePlayStoreAvailability = 'available' | 'notAvailable';
export type AndroidFakePlayStoreAction =
  | 'downloadCompletes'
  | 'downloadFails'
  | 'downloadStarts'
  | 'installCompletes'
  | 'installFails'
  | 'userAcceptsUpdate'
  | 'userCancelsDownload'
  | 'userRejectsUpdate';
export type AndroidFakePlayStoreAllowedUpdateType = 'flexible' | 'immediate';
export type AndroidFakePlayStoreStateAvailability =
  | AndroidFakePlayStoreAvailability
  | 'inProgress';
export type AndroidFakeInstallErrorCode =
  | 'app_not_owned'
  | 'app_update_api_not_available'
  | 'download_not_present'
  | 'install_not_allowed'
  | 'internal_error'
  | 'play_store_not_found'
  | 'unknown_error';

export type UnsupportedReason =
  | 'androidAppNotOwned'
  | 'androidInstallNotAllowed'
  | 'androidNotInstalledFromPlay'
  | 'nativeCapabilityUnavailable'
  | 'playFlowNotAllowed'
  | 'playStoreApiUnavailable'
  | 'runtimePlatformUnsupported';

export type ProviderErrorReason = 'invalidRemoteResponse' | 'lookupFailed';
export type AppStoreLookupErrorType = 'network' | 'system' | 'unknown';

export type InvalidConfigurationReason =
  | 'invalidCountry'
  | 'invalidIdentifierOverride'
  | 'invalidInstalledIdentifier'
  | 'invalidInstalledVersion'
  | 'invalidVersionOverride'
  | 'platformNotConfigured'
  | 'unsupportedSourceForPlatform';

export type PerformUpdateFailureReason =
  | 'activityUnavailable'
  | 'invalidUpdateRequest'
  | 'nativeCapabilityUnavailable'
  | 'openUrlFailed'
  | 'playUpdateFailed';

export type LogContext = Readonly<Record<string, unknown>>;

/**
 * Logging contract used by the library and injected into custom providers.
 * `debug` is gated by the client's `debugging.verbose` option.
 */
export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

/**
 * Reserved for future library-owned app configuration.
 * Leave empty when provided.
 */
export type ReservedAppConfig = Readonly<Record<string, never>>;

/**
 * Optional debugging-only configuration for lookup overrides and logging.
 */
export interface UpdateClientDebuggingConfig {
  readonly identifierOverride?: string;
  readonly logger?: ILogger;
  readonly verbose?: boolean;
  readonly versionOverride?: string;
}

/**
 * Installed app metadata passed to custom providers.
 */
export interface InstalledAppMetadata {
  readonly buildNumber?: string;
  readonly identifier: string;
  readonly version: string;
}

/**
 * Context available to custom update providers.
 */
export interface CustomUpdateProviderContext {
  readonly app: InstalledAppMetadata;
  readonly logger: ILogger;
  readonly platform: PlatformName;
  readonly verbose: boolean;
}

/**
 * Response contract for custom version sources.
 */
export interface CustomUpdateProviderResult<
  TMetadata extends UpdateMetadata = UpdateMetadata
> {
  readonly latestBuildNumber?: string;
  readonly latestVersion: string;
  readonly metadata?: TMetadata;
  readonly targetUrl: string;
}

/**
 * Custom update providers can be implemented as classes or plain objects.
 */
export interface CustomUpdateProvider<
  TMetadata extends UpdateMetadata = UpdateMetadata
> {
  getLatestVersion(
    context: CustomUpdateProviderContext
  ): Promise<CustomUpdateProviderResult<TMetadata>>;
}

export interface AppStoreRetryConfig {
  readonly baseDelayMs?: number;
  readonly maxAttempts?: number;
}

export interface AppStoreLookupErrorDetails {
  readonly code?: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly type: AppStoreLookupErrorType;
}

export interface AppStoreSourceConfig {
  readonly country?: string;
  readonly retry?: AppStoreRetryConfig;
  readonly type: 'appStore';
}

export interface PlayStoreSourceConfig {
  readonly flow: PlayStoreFlow;
  readonly type: 'playStore';
}

export interface FakePlayStoreSourceConfig {
  readonly flow: PlayStoreFlow;
  readonly type: 'fakePlayStore';
}

export interface CustomSourceConfig<
  TMetadata extends UpdateMetadata = UpdateMetadata
> {
  readonly provider: CustomUpdateProvider<TMetadata>;
  readonly type: 'custom';
}

export type IOSSourceConfig =
  | AppStoreSourceConfig
  | CustomSourceConfig<UpdateMetadata>;

export type AndroidSourceConfig =
  | CustomSourceConfig<UpdateMetadata>
  | FakePlayStoreSourceConfig
  | PlayStoreSourceConfig;

export interface IOSPlatformConfig {
  readonly source: IOSSourceConfig;
}

export interface AndroidPlatformConfig {
  readonly source: AndroidSourceConfig;
}

export interface UpdateClientConfig {
  /**
   * Reserved for future library-owned app configuration.
   * Leave empty when provided.
   */
  readonly app?: ReservedAppConfig;
  readonly debugging?: UpdateClientDebuggingConfig;
  readonly platforms: {
    readonly android?: AndroidPlatformConfig;
    readonly ios?: IOSPlatformConfig;
  };
}

interface AndroidFakePlayStoreBaseConfig {
  readonly allowedUpdateTypes?: readonly AndroidFakePlayStoreAllowedUpdateType[];
  readonly bytesDownloaded?: number;
  readonly clientVersionStalenessDays?: number | null;
  readonly installErrorCode?: AndroidFakeInstallErrorCode | null;
  readonly totalBytesToDownload?: number;
  readonly updatePriority?: number | null;
}

export type AndroidFakePlayStoreConfig =
  | Readonly<
      AndroidFakePlayStoreBaseConfig & {
        readonly availability: 'available';
        readonly availableVersionCode: number;
      }
    >
  | Readonly<
      AndroidFakePlayStoreBaseConfig & {
        readonly availability: 'notAvailable';
        readonly availableVersionCode?: number;
      }
    >;

export interface AndroidFakePlayStoreState {
  readonly allowedUpdateTypes: readonly AndroidFakePlayStoreAllowedUpdateType[];
  readonly availability: AndroidFakePlayStoreStateAvailability;
  readonly availableVersionCode: number | null;
  readonly bytesDownloaded: number;
  readonly clientVersionStalenessDays: number | null;
  readonly installErrorCode: AndroidFakeInstallErrorCode | null;
  readonly isConfirmationDialogVisible: boolean;
  readonly isImmediateFlowVisible: boolean;
  readonly isInstallSplashScreenVisible: boolean;
  readonly totalBytesToDownload: number;
  readonly updatePriority: number | null;
}

export type AndroidFakePlayStoreDebugResult<T> =
  | Readonly<{
      readonly kind: 'ok';
      readonly value: T;
    }>
  | Readonly<{
      readonly kind: 'unsupported';
      readonly message?: string;
      readonly reason:
        | 'nativeCapabilityUnavailable'
        | 'runtimePlatformUnsupported';
    }>;

export interface AndroidFakePlayStoreController {
  configureState(
    options: AndroidFakePlayStoreConfig
  ): Promise<AndroidFakePlayStoreDebugResult<AndroidFakePlayStoreState>>;
  dispatch(
    action: AndroidFakePlayStoreAction
  ): Promise<AndroidFakePlayStoreDebugResult<AndroidFakePlayStoreState>>;
  getState(): Promise<
    AndroidFakePlayStoreDebugResult<AndroidFakePlayStoreState>
  >;
  reset(): Promise<AndroidFakePlayStoreDebugResult<AndroidFakePlayStoreState>>;
}

export interface CheckForUpdateOptions {
  readonly mode: CheckMode;
}

interface BaseCheckResult {
  readonly installedBuildNumber?: string;
  readonly installedVersion: string;
  readonly mode: CheckMode;
  readonly platform: PlatformName;
  readonly sourceType: SourceType;
}

export interface UpToDateResult extends BaseCheckResult {
  readonly availableBuildNumber?: string;
  readonly availableVersion?: string;
  readonly kind: 'upToDate';
}

export interface UpdateAvailableResult extends BaseCheckResult {
  readonly availableBuildNumber?: string;
  readonly availableVersion?: string;
  readonly kind: 'updateAvailable';
  readonly metadata?: UpdateMetadata;
  readonly targetUrl?: string;
}

export interface UnsupportedResult {
  readonly kind: 'unsupported';
  readonly message?: string;
  readonly platform: PlatformName;
  readonly reason: UnsupportedReason;
  readonly sourceType?: SourceType;
}

export interface ProviderErrorResult {
  readonly error?: AppStoreLookupErrorDetails;
  readonly kind: 'providerError';
  readonly message?: string;
  readonly platform: PlatformName;
  readonly reason: ProviderErrorReason;
  readonly sourceType: SourceType;
}

export interface InvalidConfigurationResult {
  readonly kind: 'invalidConfiguration';
  readonly message?: string;
  readonly platform: PlatformName;
  readonly reason: InvalidConfigurationReason;
  readonly sourceType?: SourceType;
}

export type CheckResult =
  | InvalidConfigurationResult
  | ProviderErrorResult
  | UnsupportedResult
  | UpToDateResult
  | UpdateAvailableResult;

interface BasePerformUpdateResult {
  readonly platform: PlatformName;
  readonly sourceType: SourceType;
}

export interface StartedUpdateResult extends BasePerformUpdateResult {
  readonly kind: 'started';
}

export interface RedirectedUpdateResult extends BasePerformUpdateResult {
  readonly kind: 'redirected';
  readonly targetUrl: string;
}

export interface CancelledUpdateResult extends BasePerformUpdateResult {
  readonly kind: 'cancelled';
  readonly reason: 'userCancelled';
}

export interface FailedUpdateResult extends BasePerformUpdateResult {
  readonly kind: 'failed';
  readonly message?: string;
  readonly reason: PerformUpdateFailureReason;
}

export type PerformUpdateResult =
  | CancelledUpdateResult
  | FailedUpdateResult
  | RedirectedUpdateResult
  | StartedUpdateResult;

export interface UpdateClient {
  checkForUpdate(options: CheckForUpdateOptions): Promise<CheckResult>;
  performUpdate(
    result: UpdateAvailableResult & { readonly mode: 'offerUpdateAllowed' }
  ): Promise<PerformUpdateResult>;
}
