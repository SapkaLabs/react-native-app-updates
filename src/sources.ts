import type {
  AppStoreRetryConfig,
  AppStoreSourceConfig,
  CustomSourceConfig,
  CustomUpdateProvider,
  FakePlayStoreSourceConfig,
  PlayStoreFlow,
  PlayStoreSourceConfig,
  UpdateMetadata,
} from './types';

export const sources = {
  appStore(
    options: {
      country?: string;
      retry?: AppStoreRetryConfig;
    } = {}
  ): AppStoreSourceConfig {
    const retry = options.retry
      ? Object.freeze({
          baseDelayMs: options.retry.baseDelayMs,
          maxAttempts: options.retry.maxAttempts,
        })
      : undefined;

    return Object.freeze({
      country: options.country,
      retry,
      type: 'appStore' as const,
    });
  },

  custom<TMetadata extends UpdateMetadata = UpdateMetadata>(
    provider: CustomUpdateProvider<TMetadata>
  ): CustomSourceConfig<TMetadata> {
    return Object.freeze({
      provider,
      type: 'custom' as const,
    });
  },

  playStore(options: { flow?: PlayStoreFlow } = {}): PlayStoreSourceConfig {
    return Object.freeze({
      flow: options.flow ?? 'auto',
      type: 'playStore' as const,
    });
  },

  fakePlayStore(
    options: { flow?: PlayStoreFlow } = {}
  ): FakePlayStoreSourceConfig {
    return Object.freeze({
      flow: options.flow ?? 'auto',
      type: 'fakePlayStore' as const,
    });
  },
};
