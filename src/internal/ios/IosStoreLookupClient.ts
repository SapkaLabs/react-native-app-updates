import axios from 'axios';
import type {
  AppStoreLookupErrorDetails,
  AppStoreRetryConfig,
  ILogger,
  ProviderErrorReason,
} from '../../types';

interface AppStoreLookupResponse {
  readonly resultCount: number;
  readonly results: readonly AppStoreEntry[];
}

interface AppStoreEntry {
  readonly trackId?: number;
  readonly trackViewUrl?: string;
  readonly version?: string;
}

interface HttpResponse {
  readonly data: unknown;
  readonly status: number;
}

interface HttpClient {
  get(url: string): Promise<HttpResponse>;
}

type SleepFn = (delayMs: number) => Promise<void>;

export interface AppStoreInfo {
  readonly bundleId: string;
  readonly country?: string;
  readonly storeUrl: string;
  readonly version: string;
}

export interface IosStoreLookupClientOptions {
  readonly bundleId: string;
  readonly country?: string;
  readonly httpClient?: HttpClient;
  readonly logger: ILogger;
  readonly retry?: AppStoreRetryConfig;
  readonly sleep?: SleepFn;
}

const DEFAULT_BASE_DELAY_MS = 3000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_UNKNOWN_MESSAGE = 'App Store lookup failed unexpectedly.';

export class AppStoreLookupFailure extends Error {
  readonly attemptCount: number;
  readonly details: AppStoreLookupErrorDetails;
  readonly reason: ProviderErrorReason;

  constructor(
    reason: ProviderErrorReason,
    attemptCount: number,
    details: AppStoreLookupErrorDetails
  ) {
    super(details.message);
    this.name = 'AppStoreLookupFailure';
    this.attemptCount = attemptCount;
    this.details = details;
    this.reason = reason;
  }
}

export class IosStoreLookupClient {
  private readonly bundleId: string;
  private readonly country?: string;
  private readonly httpClient: HttpClient;
  private readonly logger: ILogger;
  private readonly retryConfig: Required<AppStoreRetryConfig>;
  private readonly sleep: SleepFn;

  constructor(options: IosStoreLookupClientOptions) {
    this.bundleId = options.bundleId;
    this.country = options.country;
    this.httpClient = options.httpClient ?? axios;
    this.logger = options.logger;
    this.retryConfig = normalizeRetryConfig(options.retry);
    this.sleep = options.sleep ?? delay;
  }

  async load(): Promise<AppStoreInfo> {
    return this.fetchStoreInfo();
  }

  private async fetchStoreInfo(): Promise<AppStoreInfo> {
    const url = this.buildLookupUrl();

    this.logger.debug('Fetching App Store metadata.', {
      bundleId: this.bundleId,
      country: this.country,
      url,
    });

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt += 1) {
      try {
        const response = await this.httpClient.get(url);
        return this.parseResponse(response.data, attempt);
      } catch (error) {
        const failure = normalizeLookupFailure(error, attempt);
        if (!failure.details.retryable || attempt >= this.retryConfig.maxAttempts) {
          this.logFinalFailure(failure);
          throw failure;
        }

        const delayMs = this.retryConfig.baseDelayMs * attempt;
        this.logger.debug('Retrying App Store metadata fetch.', {
          attemptCount: attempt,
          bundleId: this.bundleId,
          code: failure.details.code,
          country: this.country,
          delayMs,
          maxAttempts: this.retryConfig.maxAttempts,
          nextAttempt: attempt + 1,
          status: failure.details.status,
        });

        await this.sleep(delayMs);
      }
    }

    const failure = createLookupFailure('lookupFailed', {
      message: DEFAULT_UNKNOWN_MESSAGE,
      retryable: false,
      type: 'unknown',
    }, this.retryConfig.maxAttempts);
    this.logFinalFailure(failure);
    throw failure;
  }

  private buildLookupUrl(): string {
    const countrySegment = this.country ? `${this.country}/` : '';
    return `https://itunes.apple.com/${countrySegment}lookup?bundleId=${encodeURIComponent(
      this.bundleId
    )}`;
  }

  private logFinalFailure(failure: AppStoreLookupFailure): void {
    this.logger.error('App Store lookup failed.', {
      attemptCount: failure.attemptCount,
      bundleId: this.bundleId,
      code: failure.details.code,
      country: this.country,
      errorMessage: failure.message,
      errorType: failure.details.type,
      retryable: failure.details.retryable,
      status: failure.details.status,
    });
  }

  private parseResponse(
    payload: unknown,
    attemptCount: number
  ): AppStoreInfo {
    if (!isAppStoreLookupResponse(payload)) {
      throw createLookupFailure('invalidRemoteResponse', {
        message: 'App Store lookup returned an invalid response payload.',
        retryable: false,
        type: 'system',
      }, attemptCount);
    }

    if (!payload.resultCount || payload.results.length === 0) {
      throw createLookupFailure('invalidRemoteResponse', {
        message: 'App Store lookup did not return any results.',
        retryable: false,
        type: 'system',
      }, attemptCount);
    }

    const entry = payload.results[0];
    if (!entry || typeof entry.version !== 'string' || !entry.version.trim()) {
      throw createLookupFailure('invalidRemoteResponse', {
        message: 'App Store lookup returned an invalid version payload.',
        retryable: false,
        type: 'system',
      }, attemptCount);
    }

    const storeUrl = buildStoreUrl(entry, this.country);
    if (!storeUrl) {
      throw createLookupFailure('invalidRemoteResponse', {
        message: 'App Store lookup returned no valid store URL.',
        retryable: false,
        type: 'system',
      }, attemptCount);
    }

    return {
      bundleId: this.bundleId,
      country: this.country,
      storeUrl,
      version: entry.version,
    };
  }
}

function delay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function normalizeRetryConfig(
  retry: AppStoreRetryConfig | undefined
): Required<AppStoreRetryConfig> {
  return {
    baseDelayMs: normalizeBaseDelayMs(retry?.baseDelayMs),
    maxAttempts: normalizeMaxAttempts(retry?.maxAttempts),
  };
}

function normalizeBaseDelayMs(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return DEFAULT_BASE_DELAY_MS;
  }

  return Math.trunc(value);
}

function normalizeMaxAttempts(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return DEFAULT_MAX_ATTEMPTS;
  }

  return Math.trunc(value);
}

function normalizeLookupFailure(
  error: unknown,
  attemptCount: number
): AppStoreLookupFailure {
  if (error instanceof AppStoreLookupFailure) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    if (error.response) {
      return createLookupFailure('lookupFailed', {
        code: error.code,
        message: `App Store lookup failed with status ${error.response.status}.`,
        retryable: false,
        status: error.response.status,
        type: 'system',
      }, attemptCount);
    }

    if (error.code !== 'ERR_CANCELED') {
      return createLookupFailure('lookupFailed', {
        code: error.code,
        message: error.message || 'App Store lookup failed due to a network error.',
        retryable: true,
        type: 'network',
      }, attemptCount);
    }
  }

  return createLookupFailure('lookupFailed', {
    message: error instanceof Error ? error.message : DEFAULT_UNKNOWN_MESSAGE,
    retryable: false,
    type: 'unknown',
  }, attemptCount);
}

function createLookupFailure(
  reason: ProviderErrorReason,
  details: AppStoreLookupErrorDetails,
  attemptCount: number
): AppStoreLookupFailure {
  return new AppStoreLookupFailure(reason, attemptCount, details);
}

function isAppStoreLookupResponse(payload: unknown): payload is AppStoreLookupResponse {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }

  const response = payload as Partial<AppStoreLookupResponse>;
  return (
    typeof response.resultCount === 'number' && Array.isArray(response.results)
  );
}

function buildStoreUrl(
  entry: AppStoreEntry,
  country: string | undefined
): string | null {
  if (entry.trackViewUrl) {
    return entry.trackViewUrl.replace(/^https:\/\//i, 'itms-apps://');
  }

  if (!entry.trackId) {
    return null;
  }

  const countrySegment = country ? `${country}/` : '';
  return `itms-apps://apps.apple.com/${countrySegment}app/id${entry.trackId}`;
}
