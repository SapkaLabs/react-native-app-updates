import type {
  CheckMode,
  CheckResult,
  PlatformName,
  SourceType,
  UpdateMetadata,
} from '../../types';
import type { ResolvedInstalledAppInfo } from '../sourceContracts';
import { compareComparableVersions } from '../versioning';

interface ComparisonSourceResultInput {
  readonly availableBuildNumber?: string;
  readonly availableVersion: string;
  readonly installedApp: ResolvedInstalledAppInfo;
  readonly metadata?: UpdateMetadata;
  readonly mode: CheckMode;
  readonly platform: PlatformName;
  readonly sourceType: SourceType;
  readonly targetUrl?: string;
}

export function createComparisonSourceResult(
  input: ComparisonSourceResultInput
): CheckResult {
  const comparison = compareComparableVersions(
    {
      buildNumber: input.installedApp.buildNumber,
      version: input.installedApp.version,
    },
    {
      buildNumber: input.availableBuildNumber,
      version: input.availableVersion,
    }
  );

  if (!comparison.ok) {
    if (comparison.error.source === 'installed') {
      return {
        kind: 'invalidConfiguration',
        message: comparison.error.message,
        platform: input.platform,
        reason:
          input.installedApp.versionSource === 'override'
            ? 'invalidVersionOverride'
            : 'invalidInstalledVersion',
        sourceType: input.sourceType,
      };
    }

    return {
      kind: 'providerError',
      message: comparison.error.message,
      platform: input.platform,
      reason: 'invalidRemoteResponse',
      sourceType: input.sourceType,
    };
  }

  if (comparison.comparison >= 0) {
    return {
      availableBuildNumber: input.availableBuildNumber,
      availableVersion: input.availableVersion,
      installedBuildNumber: input.installedApp.buildNumber,
      installedVersion: input.installedApp.version,
      kind: 'upToDate',
      mode: input.mode,
      platform: input.platform,
      sourceType: input.sourceType,
    };
  }

  return {
    availableBuildNumber: input.availableBuildNumber,
    availableVersion: input.availableVersion,
    installedBuildNumber: input.installedApp.buildNumber,
    installedVersion: input.installedApp.version,
    kind: 'updateAvailable',
    metadata: input.metadata,
    mode: input.mode,
    platform: input.platform,
    sourceType: input.sourceType,
    targetUrl: input.targetUrl,
  };
}
