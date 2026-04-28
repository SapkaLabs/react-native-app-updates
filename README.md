# @sapkalabs/react-native-app-updates

[![npm version](https://img.shields.io/npm/v/%40sapkalabs%2Freact-native-app-updates)](https://www.npmjs.com/package/@sapkalabs/react-native-app-updates)
[![npm downloads](https://img.shields.io/npm/dm/%40sapkalabs%2Freact-native-app-updates)](https://www.npmjs.com/package/@sapkalabs/react-native-app-updates)
[![License](https://img.shields.io/github/license/SapkaLabs/react-native-app-updates)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/SapkaLabs/react-native-app-updates/ci.yml?branch=main&label=ci)](https://github.com/SapkaLabs/react-native-app-updates/actions/workflows/ci.yml)

TurboModule-first React Native in-app updates library for App Store, Play Store, and custom version providers.

Built for React Native teams using the New Architecture who need version checks and store-driven update flows on iOS and Android.

## Why this package?

- Built for React Native New Architecture / TurboModules.
- Supports Android Play Core update flows.
- Supports iOS App Store version lookup and redirect behavior.
- Supports custom update providers for backend-controlled, enterprise, private-store, or beta-channel update logic.
- Includes fake Play Store debugging helpers for local Android testing.
- Leaves UI, prompt timing, cooldowns, localization, and product policy to the application.

## Features

- TurboModule-first React Native library with typed public APIs.
- `sources.appStore(...)` for iOS App Store lookup and redirect flows.
- `sources.playStore(...)` for Android Play Store in-app updates.
- `sources.custom(...)` for backend-controlled or private-distribution update logic.
- `sources.fakePlayStore(...)` plus `androidDebug.fakePlayStore` for deterministic Android testing.
- Explicit `CheckResult` and `PerformUpdateResult` modeling for app-owned product decisions.

## Compatibility

- **Architecture:** verified for React Native New Architecture / TurboModules. The package uses `TurboModuleRegistry`, ships `codegenConfig`, and the example app enables `RCT_NEW_ARCH_ENABLED=1` on iOS.
- **React Native:** the repository and example app are currently pinned to React Native `0.83.0`. If you target another version, test it in your app before adopting.
- **Platforms:** iOS and Android are supported.
- **Android:** the native Android module sets `minSdkVersion` to `24` and uses Google Play Core `app-update` / `app-update-ktx` `2.1.0` for Play Store update flows.
- **iOS:** App Store support is lookup-and-redirect behavior. `performUpdate()` opens the App Store target URL; it does not perform an in-place binary update on iOS.
- **TypeScript:** published builds include TypeScript declarations.
- **Expo:** not tested or documented in this repository.

## Installation

```sh
npm install @sapkalabs/react-native-app-updates
```

If your app uses CocoaPods, install pods after adding the package.

## Quick start

```ts
import {
  createUpdateClient,
  sources,
  type ILogger,
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

if (result.canPerformUpdate()) {
  await updates.performUpdate();
}
```

`performUpdate()` only acts on the last actionable `offerUpdateAllowed` result stored on the same client instance. Use `versionCheckOnly` when you want to inspect availability without storing a pending update action.

## Platform sources

- **`sources.appStore(...)`**: iOS App Store lookup by installed bundle identifier, with optional country and retry configuration.
- **`sources.playStore(...)`**: Android Play Store update checks and in-app update launch using `auto`, `immediate`, or `flexible` flow preferences.
- **`sources.custom(...)`**: custom version source that returns a `latestVersion` and absolute `targetUrl`.
- **`sources.fakePlayStore(...)`**: Android-only fake Play backend backed by `FakeAppUpdateManager` for local testing.

## Android Play Store update flows

Use `sources.playStore({ flow })` on Android when you want native Play Store update behavior.

- `flow: 'auto'` lets the library select an allowed Play flow at runtime.
- `flow: 'immediate'` or `flow: 'flexible'` requires that flow to be allowed by Play for the current update.
- `checkForUpdate({ mode: 'offerUpdateAllowed' })` makes the result actionable for `performUpdate()`.
- `performUpdate()` returns `started`, `cancelled`, or `failed` for Play flows.
- Play Store sources always use installed Android app metadata. Debugging overrides for bundle identifier and version are ignored.

For local and CI-friendly Android testing where a real Play update is unavailable, use the fake Play backend described below.

## iOS App Store lookup

Use `sources.appStore(...)` on iOS when your binary is distributed through the App Store.

- The lookup uses the installed bundle identifier by default.
- `country` is optional and must be a two-letter App Store country code when provided.
- `performUpdate()` opens the resolved App Store URL and returns `redirected` on success.
- Debugging identifier and version overrides can help test iOS lookup behavior against alternate values.

## Custom providers

Custom providers let you keep update policy in your own backend while still using the library for version comparison and redirect behavior.

```ts
import {
  createUpdateClient,
  sources,
  type CustomUpdateProvider,
} from '@sapkalabs/react-native-app-updates';

const provider: CustomUpdateProvider = {
  async getLatestVersion({ app, platform }) {
    const response = await fetch('https://example.com/mobile-updates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: app.identifier,
        platform,
        version: app.version,
      }),
    });

    const payload = await response.json();

    return {
      latestVersion: payload.latestVersion,
      targetUrl: payload.targetUrl,
      metadata: {
        channel: payload.channel,
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

Custom providers must return a non-empty `latestVersion` and an absolute `targetUrl`.

## Debugging Android update flows with FakeAppUpdateManager

Use `sources.fakePlayStore(...)` when you want deterministic local testing of Android Play flows.

```ts
import {
  androidDebug,
  createUpdateClient,
  sources,
} from '@sapkalabs/react-native-app-updates';

const updates = createUpdateClient({
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

const result = await updates.checkForUpdate({
  mode: 'offerUpdateAllowed',
});

if (result.canPerformUpdate()) {
  await updates.performUpdate();
}

await androidDebug.fakePlayStore.dispatch('userAcceptsUpdate');
await androidDebug.fakePlayStore.dispatch('downloadStarts');
await androidDebug.fakePlayStore.dispatch('downloadCompletes');
await androidDebug.fakePlayStore.dispatch('installCompletes');
```

This is Android-only and is intended for testing, debugging, and demos. The real Play Store source should be used for production Play flows.

## Use-case examples

### Soft update prompt flow

Use an actionable check, show your own dismissible prompt, and only call `performUpdate()` if the user accepts. In practice, that means:

1. Call `checkForUpdate({ mode: 'offerUpdateAllowed' })`.
2. If `result.hasUpdates()` is `true`, render your own prompt using `currentVersion` and `availableVersion`.
3. If the user accepts and `result.canPerformUpdate()` is `true`, call `performUpdate()`.

### Force update gate flow

Use the same actionable check, but treat the result as a blocking screen in your app when your own product policy says the update is mandatory. The library reports availability and performs the platform action; your app owns the gate, copy, timing, and policy.

### Custom provider backed by an API

Use `sources.custom(provider)` when release decisions come from your backend instead of the public stores. This fits enterprise distribution, private stores, staged rollouts, or channel-specific rules.

### Android fake Play Store testing

Pair `sources.fakePlayStore(...)` with `androidDebug.fakePlayStore.configureState(...)` and `dispatch(...)` to reproduce available, rejected, in-progress, download, and install states without waiting for a real Play rollout.

## Result model

`checkForUpdate()` returns a `CheckResult` instance with enumerable fields and helper methods:

```ts
result.status; // 'hasUpdates' | 'noUpdates' | 'error'
result.currentVersion;
result.availableVersion;
result.errorType; // 'configuration' | 'provider' | 'unsupported'
result.errorMessage;
result.hasUpdates();
result.isError();
result.canPerformUpdate();
```

`performUpdate()` returns a discriminated union with one of these `kind` values:

- `started`
- `redirected`
- `cancelled`
- `failed`

## What this library does not do

- It does not provide UI components, prompts, screens, or hooks for your product flow.
- It does not own timers, cooldown windows, or update reminder schedules.
- It does not own localized strings or copy.
- It is not CodePush, OTA, or JavaScript bundle update infrastructure.
- It does not replace the App Store, Play Store, or your configured custom provider. It delegates update behavior to those platform-specific sources.

## When should I use this instead of other React Native update libraries?

Use this package when you want:

- a TurboModule-first library designed around React Native New Architecture projects,
- explicit check and perform result modeling,
- native Android Play Store flows,
- iOS App Store lookup plus redirect behavior,
- custom provider support for backend-owned update policy, or
- fake Play Store tooling for local Android debugging.

Another library may be a better fit if your app depends on the Old Architecture, or if your primary need is OTA JavaScript bundle delivery rather than store/version/update flows.

## React Native Directory notes

- **Purpose:** TurboModule-first React Native in-app updates library for App Store, Play Store, and custom version providers.
- **Architectures:** New Architecture / TurboModules.
- **Platforms:** iOS and Android.
- **Expo:** not tested or documented in this repository.

## Troubleshooting / FAQ

### Why does `performUpdate()` fail with `invalidUpdateRequest`?

Call `checkForUpdate({ mode: 'offerUpdateAllowed' })` on the same client instance before `performUpdate()`. A `versionCheckOnly` result does not store a pending update action.

### Do debug overrides affect Android Play Store checks?

No. The real and fake Play Store sources always use the installed Android app metadata.

### Does iOS perform an in-place update?

No. On iOS the library looks up the App Store target and opens that URL when you call `performUpdate()`.

### Is Expo supported?

Expo support is not tested or documented in this repository.

## Contributing

- [Development workflow](./CONTRIBUTING.md#development-workflow)
- [Sending a pull request](./CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](./CODE_OF_CONDUCT.md)

## License

MIT
