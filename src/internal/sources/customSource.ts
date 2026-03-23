import type {
  CustomSourceConfig,
  PerformUpdateResult,
  UpdateMetadata,
} from '../../types';
import type { InternalLogger } from '../logger';
import type {
  SourceCheckContext,
  SourcePerformContext,
  UpdateSource,
} from '../sourceContracts';
import { isValidTargetUrl } from '../validation';
import { createComparisonSourceResult } from './comparisonResult';

export function createCustomSource(
  config: CustomSourceConfig<UpdateMetadata>,
  logger: InternalLogger
): UpdateSource {
  return {
    async check(context: SourceCheckContext) {
      try {
        const response = await config.provider.getLatestVersion({
          app: {
            buildNumber: context.installedApp.buildNumber,
            identifier: context.installedApp.identifier,
            version: context.installedApp.version,
          },
          logger,
          platform: context.platform,
          verbose: logger.verbose,
        });

        if (!response.latestVersion?.trim()) {
          return {
            kind: 'providerError',
            message: 'Custom providers must return a non-empty latestVersion.',
            platform: context.platform,
            reason: 'invalidRemoteResponse',
            sourceType: 'custom',
          };
        }

        if (
          !response.targetUrl?.trim() ||
          !isValidTargetUrl(response.targetUrl)
        ) {
          return {
            kind: 'providerError',
            message: 'Custom providers must return an absolute targetUrl.',
            platform: context.platform,
            reason: 'invalidRemoteResponse',
            sourceType: 'custom',
          };
        }

        if (
          response.metadata !== undefined &&
          (!response.metadata ||
            Array.isArray(response.metadata) ||
            typeof response.metadata !== 'object')
        ) {
          return {
            kind: 'providerError',
            message:
              'Custom provider metadata must be a plain object when provided.',
            platform: context.platform,
            reason: 'invalidRemoteResponse',
            sourceType: 'custom',
          };
        }

        return createComparisonSourceResult({
          availableBuildNumber: response.latestBuildNumber,
          availableVersion: response.latestVersion,
          installedApp: context.installedApp,
          metadata: response.metadata,
          mode: context.mode,
          platform: context.platform,
          sourceType: 'custom',
          targetUrl: response.targetUrl,
        });
      } catch (error) {
        logger.error('Custom update provider failed.', {
          errorMessage: error instanceof Error ? error.message : String(error),
          platform: context.platform,
        });

        return {
          kind: 'providerError',
          message: error instanceof Error ? error.message : String(error),
          platform: context.platform,
          reason: 'lookupFailed',
          sourceType: 'custom',
        };
      }
    },

    async performUpdate(
      context: SourcePerformContext
    ): Promise<PerformUpdateResult> {
      const action = context.action;
      if (!action.targetUrl || !isValidTargetUrl(action.targetUrl)) {
        return {
          kind: 'failed',
          message: 'No valid target URL is available on this client state.',
          platform: context.platform,
          reason: 'invalidUpdateRequest',
          sourceType: 'custom',
        };
      }

      const openUrlResult = await context.nativeAdapter.openUrl(
        action.targetUrl
      );
      if (!openUrlResult.ok) {
        return {
          kind: 'failed',
          message: openUrlResult.message,
          platform: context.platform,
          reason: 'nativeCapabilityUnavailable',
          sourceType: 'custom',
        };
      }

      if (!openUrlResult.value.opened) {
        return {
          kind: 'failed',
          message:
            openUrlResult.value.message ??
            'Unable to open the update target URL.',
          platform: context.platform,
          reason: 'openUrlFailed',
          sourceType: 'custom',
        };
      }

      return {
        kind: 'redirected',
        platform: context.platform,
        sourceType: 'custom',
        targetUrl: action.targetUrl,
      };
    },

    type: 'custom',
  };
}
