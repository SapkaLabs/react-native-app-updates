import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  androidDebug,
  createUpdateClient,
  sources,
  type AndroidFakeInstallErrorCode,
  type AndroidFakePlayStoreAction,
  type AndroidFakePlayStoreConfig,
  type AndroidFakePlayStoreDebugResult,
  type AndroidFakePlayStoreState,
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

type AndroidBackend = 'fake' | 'real';
type AllowedUpdateTypePreset = 'both' | 'flexible' | 'immediate';

export function OfficialDiagnosticsDemo({
  bundleIdOverride,
  systemInfo,
  versionOverride,
}: OfficialDiagnosticsDemoProps) {
  const isAndroid = Platform.OS === 'android';
  const [country, setCountry] = useState('');
  const [backend, setBackend] = useState<AndroidBackend>('real');
  const [flow, setFlow] = useState<PlayStoreFlow>('auto');
  const [nativeSnapshot, setNativeSnapshot] = useState<NativeSnapshot | null>(
    null
  );
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [performResult, setPerformResult] = useState<unknown>(null);
  const [actionableResult, setActionableResult] =
    useState<ActionableResult | null>(null);
  const [fakeStateResult, setFakeStateResult] =
    useState<AndroidFakePlayStoreDebugResult<AndroidFakePlayStoreState> | null>(
      null
    );
  const [fakeAvailability, setFakeAvailability] = useState<
    'available' | 'notAvailable'
  >('available');
  const [fakeAllowedTypes, setFakeAllowedTypes] =
    useState<AllowedUpdateTypePreset>('both');
  const [fakeVersionCodeInput, setFakeVersionCodeInput] = useState('100');
  const [fakeStalenessInput, setFakeStalenessInput] = useState('3');
  const [fakePriorityInput, setFakePriorityInput] = useState('4');
  const [fakeBytesDownloadedInput, setFakeBytesDownloadedInput] = useState('0');
  const [fakeTotalBytesInput, setFakeTotalBytesInput] = useState('1024');
  const [fakeInstallErrorCodeInput, setFakeInstallErrorCodeInput] =
    useState('');

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
            backend,
            effectiveBehavior:
              'Ignored for both real and fake Play sources. Android always uses the installed app metadata.',
            identifierOverride: bundleIdOverride ?? '(not supplied)',
            versionOverride: versionOverride ?? '(not supplied)',
          }
        : {
            identifierOverride: bundleIdOverride ?? '(system)',
            versionOverride: versionOverride ?? '(system)',
          },
    [backend, bundleIdOverride, isAndroid, versionOverride]
  );

  const client = useMemo(() => {
    if (isAndroid) {
      return createUpdateClient({
        debugging: officialDebuggingConfig,
        platforms: {
          android: {
            source:
              backend === 'fake'
                ? sources.fakePlayStore({ flow })
                : sources.playStore({ flow }),
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
  }, [backend, flow, isAndroid, normalizedCountry, officialDebuggingConfig]);

  const fakeConfigPreview = useMemo(
    () =>
      buildFakePlayStoreConfig({
        allowedTypesPreset: fakeAllowedTypes,
        availability: fakeAvailability,
        bytesDownloadedInput: fakeBytesDownloadedInput,
        installErrorCodeInput: fakeInstallErrorCodeInput,
        priorityInput: fakePriorityInput,
        stalenessInput: fakeStalenessInput,
        totalBytesInput: fakeTotalBytesInput,
        versionCodeInput: fakeVersionCodeInput,
      }),
    [
      fakeAllowedTypes,
      fakeAvailability,
      fakeBytesDownloadedInput,
      fakeInstallErrorCodeInput,
      fakePriorityInput,
      fakeStalenessInput,
      fakeTotalBytesInput,
      fakeVersionCodeInput,
    ]
  );

  async function readNativeState(): Promise<void> {
    const [latestSystemInfo, playUpdateInfo, fakeState] = await Promise.all([
      readSystemAppInfo(),
      isAndroid ? readPlayUpdateInfo(backend) : Promise.resolve(null),
      isAndroid && backend === 'fake'
        ? androidDebug.fakePlayStore.getState()
        : Promise.resolve(null),
    ]);

    setNativeSnapshot({
      playUpdateInfo,
      systemInfo: latestSystemInfo,
    });
    if (fakeState) {
      setFakeStateResult(fakeState);
    }
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

  async function configureFakeState(): Promise<void> {
    setFakeStateResult(
      await androidDebug.fakePlayStore.configureState(fakeConfigPreview)
    );
  }

  async function dispatchFakeAction(
    action: AndroidFakePlayStoreAction
  ): Promise<void> {
    setFakeStateResult(await androidDebug.fakePlayStore.dispatch(action));
  }

  async function resetFakeState(): Promise<void> {
    setFakeStateResult(await androidDebug.fakePlayStore.reset());
  }

  return (
    <Card
      subtitle={
        isAndroid
          ? 'This card exercises the official Play source and the raw native Play state reader. You can switch between the real Play backend and a local fake backend for deterministic debugging.'
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
        <>
          <View style={debugStyles.fieldRow}>
            <Text style={debugStyles.fieldLabel}>Play Backend</Text>
            <SegmentedToggle
              onChange={setBackend}
              options={[
                { label: 'Real', value: 'real' },
                { label: 'Fake', value: 'fake' },
              ]}
              value={backend}
            />
            <Text style={debugStyles.helperText}>
              Both Play backends ignore bundle ID and version debug overrides.
              The fake backend lets you drive the Play state machine locally
              without relying on a real store update.
            </Text>
          </View>

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
          </View>

          {backend === 'fake' ? (
            <>
              <View style={debugStyles.fieldRow}>
                <Text style={debugStyles.fieldLabel}>Fake Availability</Text>
                <SegmentedToggle
                  onChange={setFakeAvailability}
                  options={[
                    { label: 'Available', value: 'available' },
                    { label: 'Not Available', value: 'notAvailable' },
                  ]}
                  value={fakeAvailability}
                />
              </View>

              <View style={debugStyles.fieldRow}>
                <Text style={debugStyles.fieldLabel}>
                  Fake Allowed Update Types
                </Text>
                <SegmentedToggle
                  onChange={setFakeAllowedTypes}
                  options={[
                    { label: 'Both', value: 'both' },
                    { label: 'Immediate', value: 'immediate' },
                    { label: 'Flexible', value: 'flexible' },
                  ]}
                  value={fakeAllowedTypes}
                />
              </View>

              <View style={styles.fakeConfigGrid}>
                <LabeledInput
                  editable={fakeAvailability === 'available'}
                  keyboardType="number-pad"
                  label="Version Code"
                  onChangeText={setFakeVersionCodeInput}
                  value={fakeVersionCodeInput}
                />
                <LabeledInput
                  keyboardType="number-pad"
                  label="Staleness Days"
                  onChangeText={setFakeStalenessInput}
                  value={fakeStalenessInput}
                />
                <LabeledInput
                  keyboardType="number-pad"
                  label="Update Priority"
                  onChangeText={setFakePriorityInput}
                  value={fakePriorityInput}
                />
                <LabeledInput
                  keyboardType="number-pad"
                  label="Bytes Downloaded"
                  onChangeText={setFakeBytesDownloadedInput}
                  value={fakeBytesDownloadedInput}
                />
                <LabeledInput
                  keyboardType="number-pad"
                  label="Total Bytes"
                  onChangeText={setFakeTotalBytesInput}
                  value={fakeTotalBytesInput}
                />
                <LabeledInput
                  autoCapitalize="none"
                  label="Install Error Code"
                  onChangeText={setFakeInstallErrorCodeInput}
                  value={fakeInstallErrorCodeInput}
                />
              </View>

              <View style={debugStyles.fieldRow}>
                <Text style={debugStyles.fieldLabel}>Fake Configuration</Text>
                <View style={debugStyles.actionRow}>
                  <ActionButton
                    label="Apply Fake State"
                    onPress={configureFakeState}
                  />
                  <ActionButton
                    label="Reset Fake State"
                    onPress={resetFakeState}
                    variant="secondary"
                  />
                </View>
                <Text style={debugStyles.helperText}>
                  Fake `performUpdate()` resolves as soon as the fake flow
                  starts. Use the action buttons below to simulate accept,
                  reject, download, and install progression.
                </Text>
              </View>

              <View style={debugStyles.fieldRow}>
                <Text style={debugStyles.fieldLabel}>
                  Fake Lifecycle Actions
                </Text>
                <View style={debugStyles.actionRow}>
                  <ActionButton
                    label="Accept"
                    onPress={() => dispatchFakeAction('userAcceptsUpdate')}
                    variant="secondary"
                  />
                  <ActionButton
                    label="Reject"
                    onPress={() => dispatchFakeAction('userRejectsUpdate')}
                    variant="secondary"
                  />
                  <ActionButton
                    label="Cancel Download"
                    onPress={() => dispatchFakeAction('userCancelsDownload')}
                    variant="secondary"
                  />
                  <ActionButton
                    label="Download Start"
                    onPress={() => dispatchFakeAction('downloadStarts')}
                    variant="secondary"
                  />
                  <ActionButton
                    label="Download Complete"
                    onPress={() => dispatchFakeAction('downloadCompletes')}
                    variant="secondary"
                  />
                  <ActionButton
                    label="Download Fail"
                    onPress={() => dispatchFakeAction('downloadFails')}
                    variant="secondary"
                  />
                  <ActionButton
                    label="Install Complete"
                    onPress={() => dispatchFakeAction('installCompletes')}
                    variant="secondary"
                  />
                  <ActionButton
                    label="Install Fail"
                    onPress={() => dispatchFakeAction('installFails')}
                    variant="secondary"
                  />
                </View>
              </View>

              <ResultBlock
                title="Fake Play Config Preview"
                value={fakeConfigPreview}
              />
              <ResultBlock
                title="Fake Play Controller State"
                value={fakeStateResult}
              />
            </>
          ) : (
            <Text style={debugStyles.helperText}>
              The real backend uses the device Play environment. If the device
              cannot use in-app updates locally, switch to the fake backend for
              deterministic debugging.
            </Text>
          )}
        </>
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

function buildFakePlayStoreConfig(options: {
  readonly allowedTypesPreset: AllowedUpdateTypePreset;
  readonly availability: 'available' | 'notAvailable';
  readonly bytesDownloadedInput: string;
  readonly installErrorCodeInput: string;
  readonly priorityInput: string;
  readonly stalenessInput: string;
  readonly totalBytesInput: string;
  readonly versionCodeInput: string;
}): AndroidFakePlayStoreConfig {
  const allowedUpdateTypes =
    options.allowedTypesPreset === 'both'
      ? (['flexible', 'immediate'] as const)
      : ([options.allowedTypesPreset] as const);
  const bytesDownloaded = parseOptionalPositiveInt(
    options.bytesDownloadedInput
  );
  const clientVersionStalenessDays = parseOptionalInt(options.stalenessInput);
  const installErrorCode = parseInstallErrorCode(options.installErrorCodeInput);
  const totalBytesToDownload = parseOptionalPositiveInt(
    options.totalBytesInput
  );
  const updatePriority = parseOptionalInt(options.priorityInput);

  if (options.availability === 'notAvailable') {
    return {
      allowedUpdateTypes,
      availability: 'notAvailable',
      bytesDownloaded,
      clientVersionStalenessDays,
      installErrorCode,
      totalBytesToDownload,
      updatePriority,
    };
  }

  return {
    allowedUpdateTypes,
    availability: 'available',
    availableVersionCode: parsePositiveInt(options.versionCodeInput, 100),
    bytesDownloaded,
    clientVersionStalenessDays,
    installErrorCode,
    totalBytesToDownload,
    updatePriority,
  };
}

function parseInstallErrorCode(
  value: string
): AndroidFakeInstallErrorCode | null {
  const trimmed = value.trim();
  if (
    trimmed === 'app_not_owned' ||
    trimmed === 'app_update_api_not_available' ||
    trimmed === 'download_not_present' ||
    trimmed === 'install_not_allowed' ||
    trimmed === 'internal_error' ||
    trimmed === 'play_store_not_found' ||
    trimmed === 'unknown_error'
  ) {
    return trimmed;
  }

  return null;
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalPositiveInt(value: string): number | undefined {
  const parsed = parseOptionalInt(value);
  return parsed === null ? undefined : Math.max(parsed, 0);
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = parseOptionalInt(value);
  return parsed === null || parsed <= 0 ? fallback : parsed;
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

interface LabeledInputProps {
  readonly autoCapitalize?: 'none' | 'sentences';
  readonly editable?: boolean;
  readonly keyboardType?: 'default' | 'number-pad';
  readonly label: string;
  readonly onChangeText: (value: string) => void;
  readonly value: string;
}

function LabeledInput({
  autoCapitalize = 'sentences',
  editable = true,
  keyboardType = 'default',
  label,
  onChangeText,
  value,
}: LabeledInputProps) {
  return (
    <View style={styles.fakeConfigField}>
      <Text style={debugStyles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholderTextColor={palette.subtle}
        style={[styles.compactInput, !editable && styles.inputDisabled]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  compactInput: {
    borderColor: palette.border,
    borderRadius: 10,
    borderWidth: 1,
    color: palette.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  countryInput: {
    borderColor: palette.border,
    borderRadius: 10,
    borderWidth: 1,
    color: palette.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fakeConfigField: {
    minWidth: 180,
  },
  fakeConfigGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  inputDisabled: {
    backgroundColor: '#f5f5f4',
    color: palette.subtle,
  },
});
