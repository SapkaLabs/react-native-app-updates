# @sapkalabs/react-native-app-updates

A React Native TurboModule-first library for version checks and in-app update flows on React Native 0.81+ New Architecture apps.

## Installation

```sh
npm install @sapkalabs/react-native-app-updates
```

## Usage

```ts
import {
  androidDebug,
  createUpdateClient,
  sources,
  type ILogger,
  type CustomUpdateProvider,
} from '@sapkalabs/react-native-app-updates';

const updates = createUpdateClient({
  platforms: {
    ios: {
      source: sources.appStore({
        country: 'us',
        retry: {
          maxAttempts: 3,
        },
      }),
    },
    android: {
      source: sources.playStore({
        flow: 'auto',
      }),
    },
  },
  debugging: {
    logger: console as ILogger,
    verbose: __DEV__,
  },
});

const result = await updates.checkForUpdate({
  mode: 'offerUpdateAllowed',
});

if (result.kind === 'updateAvailable' && result.mode === 'offerUpdateAllowed') {
  await updates.performUpdate(result);
}

const fakeUpdates = createUpdateClient({
  platforms: {
    android: {
      source: sources.fakePlayStore({
        flow: 'auto',
      }),
    },
  },
});

await androidDebug.fakePlayStore.configureState({
  availability: 'available',
  availableVersionCode: 100,
  allowedUpdateTypes: ['flexible', 'immediate'],
});
```

## Custom Providers

```ts
const provider: CustomUpdateProvider = {
  async getLatestVersion() {
    return {
      latestVersion: '2.0.0',
      targetUrl: 'https://example.com/app-updates',
      metadata: {
        channel: 'beta',
      },
    };
  },
};

const updates = createUpdateClient({
  platforms: {
    ios: { source: sources.custom(provider) },
    android: { source: sources.custom(provider) },
  },
});
```

## Result Model

`checkForUpdate()` returns one of:

- `upToDate`
- `updateAvailable`
- `unsupported`
- `providerError`
- `invalidConfiguration`

For App Store lookups, `providerError` can include a typed `error` object:

```ts
if (result.kind === 'providerError' && result.sourceType === 'appStore') {
  result.error?.type; // 'network' | 'system' | 'unknown'
  result.error?.message;
}
```

`performUpdate()` returns one of:

- `started`
- `redirected`
- `cancelled`
- `failed`

## Notes

- iOS store lookup uses axios internally with optional App Store-scoped retry configuration. By default it attempts the request up to 3 times with a base delay of 3000 ms for stepped network retries.
- iOS store lookup uses the installed bundle identifier by default, plus an optional App Store country. `debugging.identifierOverride` and `debugging.versionOverride` can override the installed values for iOS and custom sources.
- Android Play integration uses the native Play Core API and supports `auto`, `immediate`, and `flexible` flow selection.
- `sources.fakePlayStore(...)` uses Android's `FakeAppUpdateManager` so you can debug Play update flows locally. Use `androidDebug.fakePlayStore` to reset, configure, and advance the fake state machine.
- The official Android Play source ignores `debugging.identifierOverride` and `debugging.versionOverride` and always uses the installed app metadata.
- The library does not own timers, cooldown state, prompts, or localized UI copy.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
