import type { PlatformName, SourceType, UpdateClientConfig } from '../types';

interface NormalizedClientConfig {
  readonly app: {
    readonly identifierOverride?: string;
    readonly versionOverride?: string;
  };
  readonly logging?: UpdateClientConfig['logging'];
  readonly platforms: UpdateClientConfig['platforms'];
}

const COUNTRY_CODE_PATTERN = /^[a-z]{2}$/;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeClientConfig(
  config: UpdateClientConfig
): NormalizedClientConfig {
  const identifierOverride = normalizeOptionalString(
    config.app?.identifierOverride
  );
  const versionOverride = normalizeOptionalString(config.app?.versionOverride);
  const iosSource = config.platforms.ios?.source;

  return {
    app: {
      identifierOverride,
      versionOverride,
    },
    logging: config.logging,
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
  platform: PlatformName
) {
  return platform === 'android'
    ? config.platforms.android?.source
    : config.platforms.ios?.source;
}

export function getIdentifierOverrideError(
  identifierOverride: string | undefined,
  platform: PlatformName,
  sourceType: SourceType
): string | null {
  if (!identifierOverride) {
    return null;
  }

  if (identifierOverride.includes(' ')) {
    return 'identifierOverride must not contain whitespace.';
  }

  if (platform === 'android' && sourceType === 'playStore') {
    return null;
  }

  return null;
}

export function getVersionOverrideError(
  versionOverride: string | undefined,
  platform: PlatformName,
  sourceType: SourceType
): string | null {
  if (!versionOverride) {
    return null;
  }

  if (platform === 'android' && sourceType === 'playStore') {
    return 'versionOverride is not supported with the official Play Store source.';
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
