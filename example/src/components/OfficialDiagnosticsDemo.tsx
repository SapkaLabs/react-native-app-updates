import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  createUpdateClient,
  sources,
  type CheckMode,
  type CheckResult,
  type PlayStoreFlow,
  type UpdateAvailableResult,
} from '@sapkalabs/react-native-app-updates';
import {
  readPlayUpdateInfo,
  readSystemAppInfo,
  type NativeInstalledAppInfo,
  type NativePlayUpdateInfo,
} from '../nativeDebugBridge';
import {
  ActionButton,
  Card,
  debugStyles,
  palette,
  ResultBlock,
  SegmentedToggle,
} from './DebugUi';

interface OfficialDiagnosticsDemoProps {
  readonly bundleIdOverride?: string;
  readonly systemInfo: NativeInstalledAppInfo | null;
  readonly versionOverride?: string;
}

interface NativeSnapshot {
  readonly playUpdateInfo: NativePlayUpdateInfo | null;
  readonly systemInfo: NativeInstalledAppInfo | null;
}

type ActionableResult = UpdateAvailableResult & {
  readonly mode: 'offerUpdateAllowed';
};

export function OfficialDiagnosticsDemo({
  bundleIdOverride,
  systemInfo,
  versionOverride,
}: OfficialDiagnosticsDemoProps) {
  const isAndroid = Platform.OS === 'android';
  const [country, setCountry] = useState('');
  const [flow, setFlow] = useState<PlayStoreFlow>('auto');
  const [nativeSnapshot, setNativeSnapshot] = useState<NativeSnapshot | null>(
    null
  );
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [performResult, setPerformResult] = useState<unknown>(null);
  const [actionableResult, setActionableResult] =
    useState<ActionableResult | null>(null);

  const normalizedCountry = country.trim().toLowerCase() || undefined;

  const officialDebuggingConfig = useMemo(
    () => ({
      identifierOverride: bundleIdOverride,
      verbose: true,
      versionOverride,
    }),
    [bundleIdOverride, versionOverride]
  );

  const effectiveOfficialOverrides = useMemo(
    () =>
      isAndroid
        ? {
            effectiveBehavior:
              'Ignored for the official Play source. Android always uses the installed app metadata.',
            identifierOverride: bundleIdOverride ?? '(not supplied)',
            versionOverride: versionOverride ?? '(not supplied)',
          }
        : {
            identifierOverride: bundleIdOverride ?? '(system)',
            versionOverride: versionOverride ?? '(system)',
          },
    [bundleIdOverride, isAndroid, versionOverride]
  );

  const client = useMemo(() => {
    if (isAndroid) {
      return createUpdateClient({
        debugging: officialDebuggingConfig,
        platforms: {
          android: {
            source: sources.playStore({ flow }),
          },
        },
      });
    }

    return createUpdateClient({
      debugging: officialDebuggingConfig,
      platforms: {
        ios: {
          source: sources.appStore({ country: normalizedCountry }),
        },
      },
    });
  }, [flow, isAndroid, normalizedCountry, officialDebuggingConfig]);

  async function readNativeState(): Promise<void> {
    const [latestSystemInfo, playUpdateInfo] = await Promise.all([
      readSystemAppInfo(),
      isAndroid ? readPlayUpdateInfo() : Promise.resolve(null),
    ]);

    setNativeSnapshot({
      playUpdateInfo,
      systemInfo: latestSystemInfo,
    });
  }

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
      subtitle={
        isAndroid
          ? 'This card exercises the official Play source and the raw native Play state reader. Bundle ID overrides are forwarded here too, but Play requires the override to match the installed package name.'
          : 'This card exercises the official App Store source, including the iOS web parser, while still using native metadata and native URL opening.'
      }
      title="Official Source Diagnostics"
    >
      <View style={debugStyles.fieldRow}>
        <Text style={debugStyles.fieldLabel}>Native Diagnostic Actions</Text>
        <View style={debugStyles.actionRow}>
          <ActionButton
            label="Read Native State"
            onPress={readNativeState}
            variant="secondary"
          />
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
            label={isAndroid ? 'Start Native Update' : 'Open Store Target'}
            onPress={runPerformUpdate}
            variant="secondary"
          />
        </View>
      </View>

      {isAndroid ? (
        <View style={debugStyles.fieldRow}>
          <Text style={debugStyles.fieldLabel}>Play Flow Preference</Text>
          <SegmentedToggle
            onChange={setFlow}
            options={[
              { label: 'Auto', value: 'auto' },
              { label: 'Immediate', value: 'immediate' },
              { label: 'Flexible', value: 'flexible' },
            ]}
            value={flow}
          />
          <Text style={debugStyles.helperText}>
            Bundle ID and version overrides are passed through the debugging
            configuration, but the official Play source ignores both and always
            uses the installed Android app metadata.
          </Text>
        </View>
      ) : (
        <View style={debugStyles.fieldRow}>
          <Text style={debugStyles.fieldLabel}>App Store Country</Text>
          <TextInput
            autoCapitalize="none"
            maxLength={2}
            onChangeText={setCountry}
            placeholder="us"
            placeholderTextColor={palette.subtle}
            style={styles.countryInput}
            value={country}
          />
          <Text style={debugStyles.helperText}>
            Bundle ID and version overrides from the top of the page are applied
            to the iOS parser when enabled. Leave country empty to avoid sending
            a storefront override.
          </Text>
        </View>
      )}

      <ResultBlock
        title="Official Client Overrides"
        value={effectiveOfficialOverrides}
      />
      <ResultBlock
        title="System App Info"
        value={nativeSnapshot?.systemInfo ?? systemInfo}
      />
      {isAndroid ? (
        <ResultBlock
          title="Raw Play Native State"
          value={nativeSnapshot?.playUpdateInfo ?? null}
        />
      ) : null}
      <ResultBlock title="Official Check Result" value={checkResult} />
      <ResultBlock title="Official Perform Result" value={performResult} />
    </Card>
  );
}

const styles = StyleSheet.create({
  countryInput: {
    borderColor: palette.border,
    borderRadius: 10,
    borderWidth: 1,
    color: palette.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

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
