import type {
  AppStoreSourceConfig,
  CustomSourceConfig,
  CustomUpdateProvider,
  PlayStoreFlow,
  PlayStoreSourceConfig,
  UpdateMetadata,
} from './types';

export const sources = {
  appStore(options: { country?: string } = {}): AppStoreSourceConfig {
    return Object.freeze({
      country: options.country,
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
};
