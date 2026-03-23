import type {
  AndroidSourceConfig,
  PerformUpdateResult,
  PlayStoreFlow,
  UnsupportedReason,
} from '../../types';
import type { InternalCheckResult } from '../checkOutcome';
import type { InternalLogger } from '../logger';
import type {
  SourceCheckContext,
  SourcePerformContext,
  UpdateSource,
} from '../sourceContracts';

type ResolvedPlayAction = {
  readonly flow: 'flexible' | 'immediate';
  readonly resumeInProgress: boolean;
} | null;

type PlayStoreLikeSourceConfig = Extract<
  AndroidSourceConfig,
  { readonly type: 'fakePlayStore' | 'playStore' }
>;

export function createPlayStoreSource(
  config: AndroidSourceConfig,
  logger: InternalLogger
): UpdateSource {
  if (config.type !== 'playStore') {
    throw new Error('createPlayStoreSource expects a playStore configuration.');
  }

  return createSharedPlayStoreSource(config, logger, 'real');
}

export function createFakePlayStoreSource(
  config: AndroidSourceConfig,
  logger: InternalLogger
): UpdateSource {
  if (config.type !== 'fakePlayStore') {
    throw new Error(
      'createFakePlayStoreSource expects a fakePlayStore configuration.'
    );
  }

  return createSharedPlayStoreSource(config, logger, 'fake');
}

function createSharedPlayStoreSource(
  config: PlayStoreLikeSourceConfig,
  logger: InternalLogger,
  backend: 'fake' | 'real'
): UpdateSource {
  return {
    async check(context: SourceCheckContext) {
      const nativeInfoResult = await context.nativeAdapter.getPlayUpdateInfo(
        backend
      );
      if (!nativeInfoResult.ok) {
        return createUnsupportedResult(
          context.platform,
          mapPlayUnsupportedReason(nativeInfoResult.errorCode),
          nativeInfoResult.message
        );
      }

      const nativeInfo = nativeInfoResult.value;
      if (nativeInfo.status === 'error') {
        return createUnsupportedResult(
          context.platform,
          mapPlayUnsupportedReason(nativeInfo.errorCode),
          nativeInfo.message ?? undefined
        );
      }

      if (nativeInfo.status === 'update_not_available') {
        return {
          installedBuildNumber: context.installedApp.buildNumber,
          installedVersion: context.installedApp.version,
          kind: 'upToDate',
          mode: context.mode,
          platform: context.platform,
          sourceType: 'playStore',
        };
      }

      if (
        nativeInfo.status !== 'developer_triggered_update_in_progress' &&
        nativeInfo.status !== 'update_available'
      ) {
        return createUnsupportedResult(
          context.platform,
          'nativeCapabilityUnavailable',
          nativeInfo.message ?? 'Unexpected Play update availability state.'
        );
      }

      if (
        context.mode === 'offerUpdateAllowed' &&
        !resolvePlayAction(config.flow, nativeInfo)
      ) {
        return createUnsupportedResult(
          context.platform,
          'playFlowNotAllowed',
          `The requested Play update flow "${config.flow}" is not currently allowed.`
        );
      }

      return {
        availableBuildNumber:
          nativeInfo.availableVersionCode !== null
            ? String(nativeInfo.availableVersionCode)
            : undefined,
        installedBuildNumber: context.installedApp.buildNumber,
        installedVersion: context.installedApp.version,
        kind: 'updateAvailable',
        mode: context.mode,
        platform: context.platform,
        sourceType: 'playStore',
      };
    },

    async performUpdate(
      context: SourcePerformContext
    ): Promise<PerformUpdateResult> {
      const nativeInfoResult = await context.nativeAdapter.getPlayUpdateInfo(
        backend
      );
      if (!nativeInfoResult.ok) {
        return {
          kind: 'failed',
          message: nativeInfoResult.message,
          platform: context.platform,
          reason: 'nativeCapabilityUnavailable',
          sourceType: 'playStore',
        };
      }

      const nativeInfo = nativeInfoResult.value;
      if (nativeInfo.status === 'error') {
        return {
          kind: 'failed',
          message: nativeInfo.message ?? undefined,
          platform: context.platform,
          reason:
            nativeInfo.errorCode === 'activity_unavailable'
              ? 'activityUnavailable'
              : 'playUpdateFailed',
          sourceType: 'playStore',
        };
      }

      const action = resolvePlayAction(config.flow, nativeInfo);
      if (!action) {
        return {
          kind: 'failed',
          message: 'The requested Play update flow is no longer available.',
          platform: context.platform,
          reason: 'invalidUpdateRequest',
          sourceType: 'playStore',
        };
      }

      const startResult = await context.nativeAdapter.startPlayUpdate(
        action.flow,
        action.resumeInProgress,
        backend
      );
      if (!startResult.ok) {
        return {
          kind: 'failed',
          message: startResult.message,
          platform: context.platform,
          reason: 'nativeCapabilityUnavailable',
          sourceType: 'playStore',
        };
      }

      if (startResult.value.outcome === 'cancelled') {
        return {
          kind: 'cancelled',
          platform: context.platform,
          reason: 'userCancelled',
          sourceType: 'playStore',
        };
      }

      if (startResult.value.outcome !== 'started') {
        return {
          kind: 'failed',
          message: startResult.value.message ?? undefined,
          platform: context.platform,
          reason:
            startResult.value.errorCode === 'activity_unavailable'
              ? 'activityUnavailable'
              : 'playUpdateFailed',
          sourceType: 'playStore',
        };
      }

      logger.info('Started Play in-app update flow.', {
        backend,
        flow: action.flow,
        resumeInProgress: action.resumeInProgress,
      });

      return {
        kind: 'started',
        platform: context.platform,
        sourceType: 'playStore',
      };
    },

    type: 'playStore',
  };
}

function createUnsupportedResult(
  platform: 'android' | 'ios',
  reason: UnsupportedReason,
  message?: string
): InternalCheckResult {
  return {
    kind: 'unsupported' as const,
    message,
    platform,
    reason,
    sourceType: 'playStore' as const,
  };
}

function mapPlayUnsupportedReason(
  errorCode: string | null | undefined
): UnsupportedReason {
  switch (errorCode) {
    case 'app_not_owned':
      return 'androidAppNotOwned';

    case 'install_not_allowed':
      return 'androidInstallNotAllowed';

    case 'app_update_api_not_available':
      return 'androidNotInstalledFromPlay';

    case 'native_module_unavailable':
      return 'nativeCapabilityUnavailable';

    default:
      return 'playStoreApiUnavailable';
  }
}

function resolvePlayAction(
  flow: PlayStoreFlow,
  nativeInfo: {
    readonly flexibleAllowed: boolean;
    readonly immediateAllowed: boolean;
    readonly status: string;
  }
): ResolvedPlayAction {
  if (nativeInfo.status === 'developer_triggered_update_in_progress') {
    return {
      flow: 'immediate',
      resumeInProgress: true,
    };
  }

  if (nativeInfo.status !== 'update_available') {
    return null;
  }

  if (flow === 'auto') {
    if (nativeInfo.flexibleAllowed) {
      return {
        flow: 'flexible',
        resumeInProgress: false,
      };
    }

    if (nativeInfo.immediateAllowed) {
      return {
        flow: 'immediate',
        resumeInProgress: false,
      };
    }

    return null;
  }

  if (flow === 'flexible' && nativeInfo.flexibleAllowed) {
    return {
      flow: 'flexible',
      resumeInProgress: false,
    };
  }

  if (flow === 'immediate' && nativeInfo.immediateAllowed) {
    return {
      flow: 'immediate',
      resumeInProgress: false,
    };
  }

  return null;
}
