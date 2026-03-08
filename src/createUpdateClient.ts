import type { UpdateClient, UpdateClientConfig } from './types';
import { createInternalUpdateClient } from './internal/client';
import { createDefaultEnvironment } from './internal/defaultEnvironment';

export function createUpdateClient(config: UpdateClientConfig): UpdateClient {
  return createInternalUpdateClient(config, createDefaultEnvironment());
}
