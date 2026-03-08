import type { ILogger } from '../../types';

interface AppStoreLookupResponse {
  readonly resultCount: number;
  readonly results: readonly AppStoreEntry[];
}

interface AppStoreEntry {
  readonly trackId?: number;
  readonly trackViewUrl?: string;
  readonly version?: string;
}

export interface AppStoreInfo {
  readonly bundleId: string;
  readonly country?: string;
  readonly storeUrl: string;
  readonly version: string;
}

export interface IosStoreLookupClientOptions {
  readonly bundleId: string;
  readonly country?: string;
  readonly fetchFn: typeof fetch;
  readonly logger: ILogger;
}

export class IosStoreLookupClient {
  private static readonly cache = new Map<string, Promise<AppStoreInfo>>();

  private readonly bundleId: string;
  private readonly country?: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: ILogger;

  constructor(options: IosStoreLookupClientOptions) {
    this.bundleId = options.bundleId;
    this.country = options.country;
    this.fetchFn = options.fetchFn;
    this.logger = options.logger;
  }

  async load(): Promise<AppStoreInfo> {
    const cacheKey = `${this.bundleId}::${this.country ?? ''}`;
    const cached = IosStoreLookupClient.cache.get(cacheKey);
    if (cached) {
      this.logger.debug('Serving cached App Store metadata.', {
        bundleId: this.bundleId,
        country: this.country,
      });
      return cached;
    }

    const request = this.fetchStoreInfo();
    IosStoreLookupClient.cache.set(cacheKey, request);

    try {
      return await request;
    } catch (error) {
      IosStoreLookupClient.cache.delete(cacheKey);
      throw error;
    }
  }

  private async fetchStoreInfo(): Promise<AppStoreInfo> {
    const countrySegment = this.country ? `${this.country}/` : '';
    const url = `https://itunes.apple.com/${countrySegment}lookup?bundleId=${encodeURIComponent(
      this.bundleId
    )}`;

    this.logger.debug('Fetching App Store metadata.', {
      bundleId: this.bundleId,
      country: this.country,
      url,
    });

    const response = await this.fetchFn(url);
    if (!response.ok) {
      throw new Error(
        `App Store lookup failed with status ${response.status}.`
      );
    }

    const payload = (await response.json()) as AppStoreLookupResponse;
    if (!payload.resultCount || payload.results.length === 0) {
      throw new Error('App Store lookup did not return any results.');
    }

    const entry = payload.results[0];
    if (!entry || typeof entry.version !== 'string' || !entry.version.trim()) {
      throw new Error('App Store lookup returned an invalid version payload.');
    }

    const storeUrl = buildStoreUrl(entry, this.country);
    if (!storeUrl) {
      throw new Error('App Store lookup returned no valid store URL.');
    }

    return {
      bundleId: this.bundleId,
      country: this.country,
      storeUrl,
      version: entry.version,
    };
  }
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
