import { Platform } from 'react-native';
import NativeAppUpdates from '../NativeAppUpdates';
import type { PlatformName } from '../types';
import type { ClientEnvironment } from './client';
import { createNativeAdapter } from './nativeBridge';

function getRuntimePlatform(): PlatformName | null {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return Platform.OS;
  }

  return null;
}

export function createDefaultEnvironment(): ClientEnvironment {
  return {
    fetchFn: fetch,
    getPlatform: getRuntimePlatform,
    nativeAdapter: createNativeAdapter(NativeAppUpdates ?? null),
  };
}
