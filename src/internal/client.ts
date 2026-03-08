import type {
  AndroidSourceConfig,
  CheckForUpdateOptions,
  CheckResult,
  InvalidConfigurationResult,
  PerformUpdateResult,
  PlatformName,
  ProviderErrorResult,
  SourceType,
  UnsupportedResult,
  UpdateAvailableResult,
  UpdateClient,
  UpdateClientConfig,
} from '../types';
import { createInternalLogger, type InternalLogger } from './logger';
import type { NativeAdapter, NativeFailure } from './nativeBridge';
import type { ResolvedInstalledAppInfo, UpdateSource } from './sourceContracts';
import { createAppStoreSource } from './sources/appStoreSource';
import { createCustomSource } from './sources/customSource';
import { createPlayStoreSource } from './sources/playStoreSource';
import {
  getConfiguredPlatformSource,
  getIdentifierOverrideError,
  getVersionOverrideError,
  normalizeClientConfig,
} from './validation';

export interface ClientEnvironment {
  readonly fetchFn: typeof fetch;
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
  const logger = createInternalLogger(normalizedConfig.logging);

  return Object.freeze({
    async checkForUpdate(options: CheckForUpdateOptions): Promise<CheckResult> {
      const platform = environment.getPlatform();

      if (!platform) {
        return {
          kind: 'unsupported',
          platform: 'ios',
          reason: 'runtimePlatformUnsupported',
        };
      }

      const runtimeContext = await resolveCheckContext(
        normalizedConfig,
        platform,
        logger,
        environment
      );
      if ('kind' in runtimeContext) {
        return runtimeContext;
      }

      try {
        return await runtimeContext.source.check({
          fetchFn: environment.fetchFn,
          installedApp: runtimeContext.installedApp,
          logger,
          mode: options.mode,
          nativeAdapter: environment.nativeAdapter,
          platform,
        });
      } catch (error) {
        logger.error('Unexpected error while checking for updates.', {
          errorMessage: error instanceof Error ? error.message : String(error),
          platform,
          sourceType: runtimeContext.sourceType,
        });

        return createUnexpectedCheckFailure(
          platform,
          runtimeContext.sourceType
        );
      }
    },

    async performUpdate(
      result: UpdateAvailableResult & { readonly mode: 'offerUpdateAllowed' }
    ): Promise<PerformUpdateResult> {
      const platform = environment.getPlatform();

      if (!platform) {
        return {
          kind: 'failed',
          platform: result.platform,
          reason: 'nativeCapabilityUnavailable',
          sourceType: result.sourceType,
        };
      }

      if (
        result.platform !== platform ||
        result.mode !== 'offerUpdateAllowed'
      ) {
        return {
          kind: 'failed',
          message:
            'performUpdate expects an actionable result from the current platform.',
          platform,
          reason: 'invalidUpdateRequest',
          sourceType: result.sourceType,
        };
      }

      const runtimeContext = await resolveCheckContext(
        normalizedConfig,
        platform,
        logger,
        environment
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
          sourceType: result.sourceType,
        };
      }

      try {
        return await runtimeContext.source.performUpdate({
          fetchFn: environment.fetchFn,
          installedApp: runtimeContext.installedApp,
          logger,
          nativeAdapter: environment.nativeAdapter,
          platform,
          result,
        });
      } catch (error) {
        logger.error('Unexpected error while performing an update action.', {
          errorMessage: error instanceof Error ? error.message : String(error),
          platform,
          sourceType: result.sourceType,
        });

        return {
          kind: 'failed',
          platform,
          reason:
            result.sourceType === 'playStore'
              ? 'playUpdateFailed'
              : 'openUrlFailed',
          sourceType: result.sourceType,
        };
      }
    },
  });
}

async function resolveCheckContext(
  config: ReturnType<typeof normalizeClientConfig>,
  platform: PlatformName,
  logger: InternalLogger,
  environment: ClientEnvironment
): Promise<
  InvalidConfigurationResult | ResolvedCheckContext | UnsupportedResult
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
): InvalidConfigurationResult | UpdateSource {
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
          sourceType: sourceConfig.type,
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
          sourceType: sourceConfig.type,
        };
      }
      return createPlayStoreSource(sourceConfig as AndroidSourceConfig, logger);
  }
}

async function resolveInstalledAppInfo(
  config: ReturnType<typeof normalizeClientConfig>,
  platform: PlatformName,
  sourceConfig: NonNullable<ReturnType<typeof getConfiguredPlatformSource>>,
  nativeAdapter: NativeAdapter
): Promise<
  InvalidConfigurationResult | ResolvedInstalledAppInfo | UnsupportedResult
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
      sourceType: sourceConfig.type,
    };
  }

  if (!nativeInstalledInfo.version) {
    return {
      kind: 'invalidConfiguration',
      message: 'The native module returned an empty app version.',
      platform,
      reason: 'invalidInstalledVersion',
      sourceType: sourceConfig.type,
    };
  }

  const identifierOverride = config.app.identifierOverride;
  const versionOverride = config.app.versionOverride;

  const identifierOverrideError = getIdentifierOverrideError(
    identifierOverride,
    platform,
    sourceConfig.type
  );
  if (identifierOverrideError) {
    return {
      kind: 'invalidConfiguration',
      message: identifierOverrideError,
      platform,
      reason: 'invalidIdentifierOverride',
      sourceType: sourceConfig.type,
    };
  }

  const versionOverrideError = getVersionOverrideError(
    versionOverride,
    platform,
    sourceConfig.type
  );
  if (versionOverrideError) {
    return {
      kind: 'invalidConfiguration',
      message: versionOverrideError,
      platform,
      reason:
        platform === 'android' && sourceConfig.type === 'playStore'
          ? 'androidVersionOverrideNotSupported'
          : 'invalidVersionOverride',
      sourceType: sourceConfig.type,
    };
  }

  if (
    platform === 'android' &&
    sourceConfig.type === 'playStore' &&
    identifierOverride &&
    identifierOverride !== nativeInstalledInfo.identifier
  ) {
    return {
      kind: 'invalidConfiguration',
      message:
        'identifierOverride must match the installed Android package when using the Play Store source.',
      platform,
      reason: 'androidIdentifierOverrideMismatch',
      sourceType: sourceConfig.type,
    };
  }

  const resolvedIdentifier =
    platform === 'android' && sourceConfig.type === 'playStore'
      ? nativeInstalledInfo.identifier
      : identifierOverride ?? nativeInstalledInfo.identifier;
  const resolvedVersion =
    platform === 'android' && sourceConfig.type === 'playStore'
      ? nativeInstalledInfo.version
      : versionOverride ?? nativeInstalledInfo.version;

  return {
    buildNumber: nativeInstalledInfo.buildNumber ?? undefined,
    identifier: resolvedIdentifier,
    identifierSource: identifierOverride ? 'override' : 'native',
    version: resolvedVersion,
    versionSource: versionOverride ? 'override' : 'native',
  };
}

function createUnexpectedCheckFailure(
  platform: PlatformName,
  sourceType: SourceType
): ProviderErrorResult | UnsupportedResult {
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
): UnsupportedResult {
  return {
    kind: 'unsupported',
    message: failure.message,
    platform,
    reason: 'nativeCapabilityUnavailable',
  };
}
