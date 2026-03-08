import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  createUpdateClient,
  sources,
  type CheckMode,
  type CheckResult,
  type CustomUpdateProvider,
  type UpdateAvailableResult,
} from '@sapkalabs/react-native-app-updates';
import { ActionButton, Card, debugStyles, ResultBlock } from './DebugUi';

interface CustomProviderDemoProps {
  readonly bundleIdOverride?: string;
  readonly versionOverride?: string;
}

type ActionableResult = UpdateAvailableResult & {
  readonly mode: 'offerUpdateAllowed';
};

const demoProvider: CustomUpdateProvider = {
  async getLatestVersion() {
    return {
      latestVersion: '999.0.0',
      metadata: {
        channel: 'demo',
      },
      targetUrl: 'https://example.com/app-updates',
    };
  },
};

export function CustomProviderDemo({
  bundleIdOverride,
  versionOverride,
}: CustomProviderDemoProps) {
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [performResult, setPerformResult] = useState<unknown>(null);
  const [actionableResult, setActionableResult] =
    useState<ActionableResult | null>(null);

  const client = useMemo(
    () =>
      createUpdateClient({
        app:
          bundleIdOverride || versionOverride
            ? {
                identifierOverride: bundleIdOverride,
                versionOverride,
              }
            : undefined,
        logging: {
          verbose: true,
        },
        platforms: {
          android: {
            source: sources.custom(demoProvider),
          },
          ios: {
            source: sources.custom(demoProvider),
          },
        },
      }),
    [bundleIdOverride, versionOverride]
  );

  async function runCheck(mode: CheckMode): Promise<void> {
    setPerformResult(null);
    const result = await client.checkForUpdate({ mode });
    setCheckResult(result);
    setActionableResult(toActionableResult(result, mode));
  }

  async function runPerformUpdate(): Promise<void> {
    if (!actionableResult) {
      return;
    }

    const result = await client.performUpdate(actionableResult);
    setPerformResult(result);
  }

  return (
    <Card
      subtitle="This is the original example behavior, now isolated into its own memoized component. It always uses a custom TypeScript provider and respects the top-level overrides."
      title="Custom Provider Demo"
    >
      <ResultBlock
        fallback="The provider is configured but no check has run yet."
        title="Provider Details"
        value={{
          latestVersion: '999.0.0',
          metadata: { channel: 'demo' },
          targetUrl: 'https://example.com/app-updates',
        }}
      />

      <ResultBlock
        title="Effective Overrides"
        value={{
          identifierOverride: bundleIdOverride ?? '(system)',
          versionOverride: versionOverride ?? '(system)',
        }}
      />

      <View style={debugStyles.actionRow}>
        <ActionButton
          label="Version Check Only"
          onPress={() => runCheck('versionCheckOnly')}
          variant="secondary"
        />
        <ActionButton
          label="Check + Offer"
          onPress={() => runCheck('offerUpdateAllowed')}
        />
        <ActionButton
          disabled={!actionableResult}
          label="Perform Update"
          onPress={runPerformUpdate}
          variant="secondary"
        />
      </View>

      <Text style={debugStyles.helperText}>
        Top-level bundle ID and version overrides are passed into this client
        when enabled.
      </Text>

      <ResultBlock title="Check Result" value={checkResult} />
      <ResultBlock title="Perform Result" value={performResult} />
    </Card>
  );
}

function toActionableResult(
  result: CheckResult,
  mode: CheckMode
): ActionableResult | null {
  if (result.kind !== 'updateAvailable' || mode !== 'offerUpdateAllowed') {
    return null;
  }

  return {
    ...result,
    mode: 'offerUpdateAllowed',
  };
}
