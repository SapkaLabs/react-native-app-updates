import type {
  AppStoreLookupErrorDetails,
  CheckMode,
  InvalidConfigurationReason,
  PlatformName,
  ProviderErrorReason,
  SourceType,
  UnsupportedReason,
  UpdateMetadata,
} from '../types';

interface InternalBaseCheckResult {
  readonly installedBuildNumber?: string;
  readonly installedVersion: string;
  readonly mode: CheckMode;
  readonly platform: PlatformName;
  readonly sourceType: SourceType;
}

export interface InternalUpToDateResult extends InternalBaseCheckResult {
  readonly availableBuildNumber?: string;
  readonly availableVersion?: string;
  readonly kind: 'upToDate';
}

export interface InternalUpdateAvailableResult extends InternalBaseCheckResult {
  readonly availableBuildNumber?: string;
  readonly availableVersion?: string;
  readonly kind: 'updateAvailable';
  readonly metadata?: UpdateMetadata;
  readonly targetUrl?: string;
}

export interface InternalUnsupportedResult {
  readonly kind: 'unsupported';
  readonly message?: string;
  readonly platform: PlatformName;
  readonly reason: UnsupportedReason;
  readonly sourceType?: SourceType;
}

export interface InternalProviderErrorResult {
  readonly error?: AppStoreLookupErrorDetails;
  readonly kind: 'providerError';
  readonly message?: string;
  readonly platform: PlatformName;
  readonly reason: ProviderErrorReason;
  readonly sourceType: SourceType;
}

export interface InternalInvalidConfigurationResult {
  readonly kind: 'invalidConfiguration';
  readonly message?: string;
  readonly platform: PlatformName;
  readonly reason: InvalidConfigurationReason;
  readonly sourceType?: SourceType;
}

export type InternalCheckResult =
  | InternalInvalidConfigurationResult
  | InternalProviderErrorResult
  | InternalUnsupportedResult
  | InternalUpToDateResult
  | InternalUpdateAvailableResult;

export interface PendingUpdateAction {
  readonly platform: PlatformName;
  readonly sourceType: SourceType;
  readonly targetUrl?: string;
}
