import type {
  CheckMode,
  PerformUpdateResult,
  PlatformName,
  SourceType,
} from '../types';
import type { InternalCheckResult, PendingUpdateAction } from './checkOutcome';
import type { InternalLogger } from './logger';
import type { NativeAdapter } from './nativeBridge';

export interface ResolvedInstalledAppInfo {
  readonly buildNumber?: string;
  readonly identifier: string;
  readonly identifierSource: 'native' | 'override';
  readonly version: string;
  readonly versionSource: 'native' | 'override';
}

export interface SourceCheckContext {
  readonly installedApp: ResolvedInstalledAppInfo;
  readonly logger: InternalLogger;
  readonly mode: CheckMode;
  readonly nativeAdapter: NativeAdapter;
  readonly platform: PlatformName;
}

export interface SourcePerformContext {
  readonly action: PendingUpdateAction;
  readonly installedApp: ResolvedInstalledAppInfo;
  readonly logger: InternalLogger;
  readonly nativeAdapter: NativeAdapter;
  readonly platform: PlatformName;
}

export interface UpdateSource {
  readonly type: SourceType;
  check(context: SourceCheckContext): Promise<InternalCheckResult>;
  performUpdate(context: SourcePerformContext): Promise<PerformUpdateResult>;
}
