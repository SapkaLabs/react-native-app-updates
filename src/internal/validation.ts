import type { UpdateClientConfig, UpdateClientDebuggingConfig } from '../types';

interface NormalizedClientConfig {
  readonly app?: UpdateClientConfig['app'];
  readonly debugging: UpdateClientDebuggingConfig;
  readonly platforms: UpdateClientConfig['platforms'];
}

const COUNTRY_CODE_PATTERN = /^[a-z]{2}$/;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeClientConfig(
  config: UpdateClientConfig
): NormalizedClientConfig {
  const identifierOverride = normalizeOptionalString(
    config.debugging?.identifierOverride
  );
  const versionOverride = normalizeOptionalString(
    config.debugging?.versionOverride
  );
  const iosSource = config.platforms.ios?.source;

  return {
    app: config.app,
    debugging: {
      identifierOverride,
      logger: config.debugging?.logger,
      verbose: config.debugging?.verbose,
      versionOverride,
    },
    platforms: {
      android: config.platforms.android,
      ios: iosSource
        ? {
            source:
              iosSource.type === 'appStore'
                ? {
                     country: normalizeOptionalString(
                       iosSource.country
                     )?.toLowerCase(),
                     retry: iosSource.retry
                       ? {
                           baseDelayMs: iosSource.retry.baseDelayMs,
                           maxAttempts: iosSource.retry.maxAttempts,
                         }
                       : undefined,
                     type: 'appStore',
                   }
                 : iosSource,
          }
        : undefined,
    },
  };
}

export function getConfiguredPlatformSource(
  config: NormalizedClientConfig,
  platform: 'android' | 'ios'
) {
  return platform === 'android'
    ? config.platforms.android?.source
    : config.platforms.ios?.source;
}

export function getIdentifierOverrideError(
  identifierOverride: string | undefined
): string | null {
  if (!identifierOverride) {
    return null;
  }

  if (identifierOverride.includes(' ')) {
    return 'identifierOverride must not contain whitespace.';
  }

  return null;
}

export function isValidCountryCode(country: string | undefined): boolean {
  return !country || COUNTRY_CODE_PATTERN.test(country);
}

export function isValidTargetUrl(url: string): boolean {
  return URL_SCHEME_PATTERN.test(url);
}

export function normalizeOptionalString(
  value: string | undefined
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
