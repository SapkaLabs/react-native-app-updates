import type { AppStoreSourceConfig, PerformUpdateResult } from '../../types';
import {
  AppStoreLookupFailure,
  IosStoreLookupClient,
} from '../ios/IosStoreLookupClient';
import type { InternalLogger } from '../logger';
import type {
  SourceCheckContext,
  SourcePerformContext,
  UpdateSource,
} from '../sourceContracts';
import { isValidCountryCode } from '../validation';
import { createComparisonSourceResult } from './comparisonResult';

export function createAppStoreSource(
  config: AppStoreSourceConfig,
  logger: InternalLogger
): UpdateSource {
  return {
    async check(context: SourceCheckContext) {
      if (config.country && !isValidCountryCode(config.country)) {
        return {
          kind: 'invalidConfiguration',
          message: 'country must be a two-letter App Store country code.',
          platform: context.platform,
          reason: 'invalidCountry',
          sourceType: 'appStore',
        };
      }

      try {
        const client = new IosStoreLookupClient({
          bundleId: context.installedApp.identifier,
          country: config.country,
          logger,
          retry: config.retry,
        });

        const storeInfo = await client.load();
        return createComparisonSourceResult({
          availableVersion: storeInfo.version,
          installedApp: context.installedApp,
          mode: context.mode,
          platform: context.platform,
          sourceType: 'appStore',
          targetUrl: storeInfo.storeUrl,
        });
      } catch (error) {
        if (error instanceof AppStoreLookupFailure) {
          return {
            error: error.details,
            kind: 'providerError',
            message: error.message,
            platform: context.platform,
            reason: error.reason,
            sourceType: 'appStore',
          };
        }

        const message =
          error instanceof Error ? error.message : 'Unknown App Store error.';

        logger.error('App Store lookup failed.', {
          bundleId: context.installedApp.identifier,
          country: config.country,
          errorMessage: message,
        });

        return {
          error: {
            message,
            retryable: false,
            type: 'unknown',
          },
          kind: 'providerError',
          message,
          platform: context.platform,
          reason: 'lookupFailed',
          sourceType: 'appStore',
        };
      }
    },

    async performUpdate(
      context: SourcePerformContext
    ): Promise<PerformUpdateResult> {
      const action = context.action;
      if (!action.targetUrl) {
        return {
          kind: 'failed',
          message: 'No App Store target URL is available on this client state.',
          platform: context.platform,
          reason: 'invalidUpdateRequest',
          sourceType: 'appStore',
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
          sourceType: 'appStore',
        };
      }

      if (!openUrlResult.value.opened) {
        return {
          kind: 'failed',
          message:
            openUrlResult.value.message ?? 'Unable to open the App Store URL.',
          platform: context.platform,
          reason: 'openUrlFailed',
          sourceType: 'appStore',
        };
      }

      return {
        kind: 'redirected',
        platform: context.platform,
        sourceType: 'appStore',
        targetUrl: action.targetUrl,
      };
    },

    type: 'appStore',
  };
}
