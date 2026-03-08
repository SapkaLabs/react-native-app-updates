import type {
  CheckMode,
  CheckResult,
  PerformUpdateResult,
  PlatformName,
  SourceType,
  UpdateAvailableResult,
} from '../types';
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
  readonly fetchFn: typeof fetch;
  readonly installedApp: ResolvedInstalledAppInfo;
  readonly logger: InternalLogger;
  readonly mode: CheckMode;
  readonly nativeAdapter: NativeAdapter;
  readonly platform: PlatformName;
}

export interface SourcePerformContext {
  readonly fetchFn: typeof fetch;
  readonly installedApp: ResolvedInstalledAppInfo;
  readonly logger: InternalLogger;
  readonly nativeAdapter: NativeAdapter;
  readonly platform: PlatformName;
  readonly result: UpdateAvailableResult & {
    readonly mode: 'offerUpdateAllowed';
  };
}

export interface UpdateSource {
  readonly type: SourceType;
  check(context: SourceCheckContext): Promise<CheckResult>;
  performUpdate(context: SourcePerformContext): Promise<PerformUpdateResult>;
}
