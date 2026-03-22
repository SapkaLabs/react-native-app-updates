import { Platform } from 'react-native';
import NativeAppUpdates from './NativeAppUpdates';
import { createAndroidFakePlayStoreController } from './internal/androidDebugController';
import { createNativeAdapter } from './internal/nativeBridge';

export const androidDebug = Object.freeze({
  fakePlayStore: createAndroidFakePlayStoreController(
    createNativeAdapter(NativeAppUpdates ?? null),
    () => {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        return Platform.OS;
      }

      return null;
    }
  ),
});
