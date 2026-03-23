import {
  CheckResult,
  type AndroidSourceConfig,
  type CheckForUpdateOptions,
  type PerformUpdateResult,
  type PlatformName,
  type SourceType,
  type UpdateClient,
  type UpdateClientConfig,
} from '../types';
import type {
  InternalCheckResult,
  InternalInvalidConfigurationResult,
  InternalProviderErrorResult,
  InternalUnsupportedResult,
  PendingUpdateAction,
} from './checkOutcome';
import { createInternalLogger, type InternalLogger } from './logger';
import type { NativeAdapter, NativeFailure } from './nativeBridge';
import type { ResolvedInstalledAppInfo, UpdateSource } from './sourceContracts';
import { createAppStoreSource } from './sources/appStoreSource';
import { createCustomSource } from './sources/customSource';
import {
  createFakePlayStoreSource,
  createPlayStoreSource,
} from './sources/playStoreSource';
import {
  getConfiguredPlatformSource,
  getIdentifierOverrideError,
  normalizeClientConfig,
} from './validation';

export interface ClientEnvironment {
  readonly getPlatform: () => PlatformName | null;
  readonly nativeAdapter: NativeAdapter;
}

interface ResolvedCheckContext {
  readonly installedApp: ResolvedInstalledAppInfo;
  readonly platform: PlatformName;
  readonly source: UpdateSource;
  readonly sourceType: SourceType;
}

export function createInternalUpdateClient(
  config: UpdateClientConfig,
  environment: ClientEnvironment
): UpdateClient {
  const normalizedConfig = normalizeClientConfig(config);
  return new InternalUpdateClient(
    normalizedConfig,
    environment,
    createInternalLogger(normalizedConfig.debugging)
  );
}

class InternalUpdateClient implements UpdateClient {
  #pendingUpdateAction: PendingUpdateAction | null = null;

  private get pendingUpdateAction(): PendingUpdateAction | null {
    return this.#pendingUpdateAction;
  }

  private set pendingUpdateAction(value: PendingUpdateAction | null) {
    this.#pendingUpdateAction = value;
  }
  constructor(
    private readonly normalizedConfig: ReturnType<typeof normalizeClientConfig>,
    private readonly environment: ClientEnvironment,
    private readonly logger: InternalLogger
  ) {}

  async checkForUpdate(options: CheckForUpdateOptions): Promise<CheckResult> {
    const platform = this.environment.getPlatform();
    if (!platform) {
      this.clearPendingUpdateAction();
      return new CheckResult({
        errorMessage: 'The current runtime platform is not supported.',
        errorType: 'unsupported',
        status: 'error',
      });
    }

    const runtimeContext = await resolveCheckContext(
      this.normalizedConfig,
      platform,
      this.logger,
      this.environment
    );
    if ('kind' in runtimeContext) {
      this.clearPendingUpdateAction();
      return toPublicCheckResult(runtimeContext, false);
    }

    try {
      const result = await runtimeContext.source.check({
        installedApp: runtimeContext.installedApp,
        logger: this.logger,
        mode: options.mode,
        nativeAdapter: this.environment.nativeAdapter,
        platform,
      });

      const canPerformUpdate = this.updatePendingActionFromCheckResult(result);
      return toPublicCheckResult(result, canPerformUpdate);
    } catch (error) {
      this.logger.error('Unexpected error while checking for updates.', {
        errorMessage: error instanceof Error ? error.message : String(error),
        platform,
        sourceType: runtimeContext.sourceType,
      });

      this.clearPendingUpdateAction();
      return toPublicCheckResult(
        createUnexpectedCheckFailure(platform, runtimeContext.sourceType),
        false
      );
    }
  }

  async performUpdate(): Promise<PerformUpdateResult> {
    const pendingAction = this.pendingUpdateAction;
    if (!pendingAction) {
      const platform = this.environment.getPlatform();
      return {
        kind: 'failed',
        message: 'No pending update is stored on this client instance.',
        platform: platform ?? resolveFallbackPlatform(this.normalizedConfig),
        reason: 'invalidUpdateRequest',
        sourceType: resolveFallbackSourceType(this.normalizedConfig, platform),
      };
    }

    const platform = this.environment.getPlatform();
    if (!platform) {
      return {
        kind: 'failed',
        platform: pendingAction.platform,
        reason: 'nativeCapabilityUnavailable',
        sourceType: pendingAction.sourceType,
      };
    }

    if (pendingAction.platform !== platform) {
      return {
        kind: 'failed',
        message:
          'No pending update is stored on this client instance for the current platform.',
        platform,
        reason: 'invalidUpdateRequest',
        sourceType: pendingAction.sourceType,
      };
    }

    const runtimeContext = await resolveCheckContext(
      this.normalizedConfig,
      platform,
      this.logger,
      this.environment
    );
    if ('kind' in runtimeContext) {
      return {
        kind: 'failed',
        message: runtimeContext.message,
        platform,
        reason:
          runtimeContext.kind === 'unsupported'
            ? 'nativeCapabilityUnavailable'
            : 'invalidUpdateRequest',
        sourceType: pendingAction.sourceType,
      };
    }

    try {
      return await runtimeContext.source.performUpdate({
        action: pendingAction,
        installedApp: runtimeContext.installedApp,
        logger: this.logger,
        nativeAdapter: this.environment.nativeAdapter,
        platform,
      });
    } catch (error) {
      this.logger.error('Unexpected error while performing an update action.', {
        errorMessage: error instanceof Error ? error.message : String(error),
        platform,
        sourceType: pendingAction.sourceType,
      });

      return {
        kind: 'failed',
        platform,
        reason:
          pendingAction.sourceType === 'playStore'
            ? 'playUpdateFailed'
            : 'openUrlFailed',
        sourceType: pendingAction.sourceType,
      };
    }
  }

  private clearPendingUpdateAction(): void {
    this.pendingUpdateAction = null;
  }

  private updatePendingActionFromCheckResult(
    result: InternalCheckResult
  ): boolean {
    if (result.kind !== 'updateAvailable') {
      this.clearPendingUpdateAction();
      return false;
    }

    if (result.mode !== 'offerUpdateAllowed') {
      this.clearPendingUpdateAction();
      return false;
    }

    this.pendingUpdateAction = {
      platform: result.platform,
      sourceType: result.sourceType,
      targetUrl: result.targetUrl,
    };
    return true;
  }
}

function toPublicSourceType(
  sourceType:
    | NonNullable<ReturnType<typeof getConfiguredPlatformSource>>['type']
    | SourceType
): SourceType {
  return sourceType === 'fakePlayStore' ? 'playStore' : sourceType;
}

function toPublicCheckResult(
  result:
    | InternalCheckResult
    | InternalInvalidConfigurationResult
    | InternalProviderErrorResult
    | InternalUnsupportedResult,
  canPerformUpdate: boolean
): CheckResult {
  switch (result.kind) {
    case 'updateAvailable':
      return new CheckResult({
        availableVersion: result.availableVersion,
        canPerformUpdate,
        currentVersion: result.installedVersion,
        status: 'hasUpdates',
      });

    case 'upToDate':
      return new CheckResult({
        availableVersion: result.availableVersion,
        currentVersion: result.installedVersion,
        status: 'noUpdates',
      });

    case 'invalidConfiguration':
      return new CheckResult({
        errorMessage: result.message,
        errorType: 'configuration',
        status: 'error',
      });

    case 'providerError':
      return new CheckResult({
        errorMessage: result.message,
        errorType: 'provider',
        status: 'error',
      });

    case 'unsupported':
      return new CheckResult({
        errorMessage: result.message,
        errorType: 'unsupported',
        status: 'error',
      });
  }
}

async function resolveCheckContext(
  config: ReturnType<typeof normalizeClientConfig>,
  platform: PlatformName,
  logger: InternalLogger,
  environment: ClientEnvironment
): Promise<
  | InternalInvalidConfigurationResult
  | InternalUnsupportedResult
  | ResolvedCheckContext
> {
  const platformConfig = getConfiguredPlatformSource(config, platform);
  if (!platformConfig) {
    return {
      kind: 'invalidConfiguration',
      message: `No ${platform} source was configured for this client.`,
      platform,
      reason: 'platformNotConfigured',
    };
  }

  const source = createSource(platform, platformConfig, logger);
  if ('kind' in source) {
    return source;
  }

  const installedApp = await resolveInstalledAppInfo(
    config,
    platform,
    platformConfig,
    environment.nativeAdapter
  );
  if ('kind' in installedApp) {
    return installedApp;
  }

  return {
    installedApp,
    platform,
    source,
    sourceType: source.type,
  };
}

function createSource(
  platform: PlatformName,
  sourceConfig:
    | ReturnType<typeof getConfiguredPlatformSource>
    | NonNullable<ReturnType<typeof getConfiguredPlatformSource>>,
  logger: InternalLogger
): InternalInvalidConfigurationResult | UpdateSource {
  if (!sourceConfig) {
    return {
      kind: 'invalidConfiguration',
      message: `No source configuration is available for ${platform}.`,
      platform,
      reason: 'platformNotConfigured',
    };
  }

  switch (sourceConfig.type) {
    case 'appStore':
      if (platform !== 'ios') {
        return {
          kind: 'invalidConfiguration',
          message: 'The App Store source can only be used on iOS.',
          platform,
          reason: 'unsupportedSourceForPlatform',
          sourceType: toPublicSourceType(sourceConfig.type),
        };
      }
      return createAppStoreSource(sourceConfig, logger);

    case 'custom':
      return createCustomSource(sourceConfig, logger);

    case 'playStore':
      if (platform !== 'android') {
        return {
          kind: 'invalidConfiguration',
          message: 'The Play Store source can only be used on Android.',
          platform,
          reason: 'unsupportedSourceForPlatform',
          sourceType: toPublicSourceType(sourceConfig.type),
        };
      }
      return createPlayStoreSource(sourceConfig as AndroidSourceConfig, logger);

    case 'fakePlayStore':
      if (platform !== 'android') {
        return {
          kind: 'invalidConfiguration',
          message: 'The Play Store source can only be used on Android.',
          platform,
          reason: 'unsupportedSourceForPlatform',
          sourceType: 'playStore',
        };
      }
      return createFakePlayStoreSource(
        sourceConfig as AndroidSourceConfig,
        logger
      );
  }
}

async function resolveInstalledAppInfo(
  config: ReturnType<typeof normalizeClientConfig>,
  platform: PlatformName,
  sourceConfig: NonNullable<ReturnType<typeof getConfiguredPlatformSource>>,
  nativeAdapter: NativeAdapter
): Promise<
  | InternalInvalidConfigurationResult
  | InternalUnsupportedResult
  | ResolvedInstalledAppInfo
> {
  const installedInfoResult = await nativeAdapter.getInstalledAppInfo();
  if (!installedInfoResult.ok) {
    return mapInstalledInfoFailure(platform, installedInfoResult);
  }

  const nativeInstalledInfo = installedInfoResult.value;
  if (!nativeInstalledInfo.identifier) {
    return {
      kind: 'invalidConfiguration',
      message: 'The native module returned an empty app identifier.',
      platform,
      reason: 'invalidInstalledIdentifier',
      sourceType: toPublicSourceType(sourceConfig.type),
    };
  }

  if (!nativeInstalledInfo.version) {
    return {
      kind: 'invalidConfiguration',
      message: 'The native module returned an empty app version.',
      platform,
      reason: 'invalidInstalledVersion',
      sourceType: toPublicSourceType(sourceConfig.type),
    };
  }

  const shouldIgnoreDebugOverrides =
    platform === 'android' &&
    (sourceConfig.type === 'fakePlayStore' ||
      sourceConfig.type === 'playStore');
  const identifierOverride = shouldIgnoreDebugOverrides
    ? undefined
    : config.debugging.identifierOverride;
  const versionOverride = shouldIgnoreDebugOverrides
    ? undefined
    : config.debugging.versionOverride;

  const identifierOverrideError =
    getIdentifierOverrideError(identifierOverride);
  if (identifierOverrideError) {
    return {
      kind: 'invalidConfiguration',
      message: identifierOverrideError,
      platform,
      reason: 'invalidIdentifierOverride',
      sourceType: toPublicSourceType(sourceConfig.type),
    };
  }

  return {
    buildNumber: nativeInstalledInfo.buildNumber ?? undefined,
    identifier: identifierOverride ?? nativeInstalledInfo.identifier,
    identifierSource: identifierOverride ? 'override' : 'native',
    version: versionOverride ?? nativeInstalledInfo.version,
    versionSource: versionOverride ? 'override' : 'native',
  };
}

function createUnexpectedCheckFailure(
  platform: PlatformName,
  sourceType: SourceType
): InternalProviderErrorResult | InternalUnsupportedResult {
  if (sourceType === 'playStore') {
    return {
      kind: 'unsupported',
      message: 'The Play update capability failed unexpectedly.',
      platform,
      reason: 'nativeCapabilityUnavailable',
      sourceType,
    };
  }

  return {
    kind: 'providerError',
    message: 'The update source failed unexpectedly.',
    platform,
    reason: 'lookupFailed',
    sourceType,
  };
}

function mapInstalledInfoFailure(
  platform: PlatformName,
  failure: NativeFailure
): InternalUnsupportedResult {
  return {
    kind: 'unsupported',
    message: failure.message,
    platform,
    reason: 'nativeCapabilityUnavailable',
  };
}

function resolveFallbackPlatform(
  config: ReturnType<typeof normalizeClientConfig>
): PlatformName {
  return config.platforms.ios ? 'ios' : 'android';
}

function resolveFallbackSourceType(
  config: ReturnType<typeof normalizeClientConfig>,
  platform: PlatformName | null
): SourceType {
  if (platform) {
    const sourceConfig = getConfiguredPlatformSource(config, platform);
    if (sourceConfig) {
      return toPublicSourceType(sourceConfig.type);
    }
  }

  if (config.platforms.ios?.source) {
    return toPublicSourceType(config.platforms.ios.source.type);
  }

  if (config.platforms.android?.source) {
    return toPublicSourceType(config.platforms.android.source.type);
  }

  return 'custom';
}
