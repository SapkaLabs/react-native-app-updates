# @sapkalabs/react-native-app-updates

A React Native TurboModule-first library for version checks and in-app update flows on React Native 0.81+ New Architecture apps.

## Installation

```sh
npm install @sapkalabs/react-native-app-updates
```

## Usage

```ts
import {
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
      }),
    },
    android: {
      source: sources.playStore({
        flow: 'auto',
      }),
    },
  },
  logging: {
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

`performUpdate()` returns one of:

- `started`
- `redirected`
- `cancelled`
- `failed`

## Notes

- iOS store lookup uses the installed bundle identifier and optional App Store country.
- Android Play integration uses the native Play Core API and supports `auto`, `immediate`, and `flexible` flow selection.
- The library does not own timers, cooldown state, prompts, or localized UI copy.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
