import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  type NativeInstalledAppInfo,
  readSystemAppInfo,
} from './nativeDebugBridge';
import {
  ActionButton,
  Card,
  debugStyles,
  palette,
  SegmentedToggle,
} from './components/DebugUi';
import { CustomProviderDemo } from './components/CustomProviderDemo';
import { OfficialDiagnosticsDemo } from './components/OfficialDiagnosticsDemo';

export default function App() {
  const [systemInfo, setSystemInfo] = useState<NativeInstalledAppInfo | null>(
    null
  );
  const [systemInfoError, setSystemInfoError] = useState<string | null>(null);
  const [overrideMode, setOverrideMode] = useState<'override' | 'system'>(
    'system'
  );
  const [versionInput, setVersionInput] = useState('');
  const [bundleIdInput, setBundleIdInput] = useState('');

  const loadSystemInfo = useCallback(async (): Promise<void> => {
    const info = await readSystemAppInfo();
    setSystemInfo(info);
    setSystemInfoError(
      info ? null : 'The AppUpdates TurboModule is unavailable.'
    );
  }, []);

  useEffect(() => {
    loadSystemInfo().catch((error) => {
      setSystemInfoError(
        error instanceof Error ? error.message : String(error)
      );
    });
  }, [loadSystemInfo]);

  useEffect(() => {
    if (!systemInfo) {
      return;
    }

    setVersionInput((currentValue) => currentValue || systemInfo.version);
    setBundleIdInput((currentValue) => currentValue || systemInfo.identifier);
  }, [systemInfo]);

  const resolvedOverrides = useMemo(
    () => ({
      bundleIdOverride:
        overrideMode === 'override' && bundleIdInput.trim()
          ? bundleIdInput.trim()
          : undefined,
      versionOverride:
        overrideMode === 'override' && versionInput.trim()
          ? versionInput.trim()
          : undefined,
    }),
    [bundleIdInput, overrideMode, versionInput]
  );

  const effectiveVersion =
    resolvedOverrides.versionOverride ?? systemInfo?.version ?? 'Unavailable';
  const effectiveBundleId =
    resolvedOverrides.bundleIdOverride ??
    systemInfo?.identifier ??
    'Unavailable';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>
            {Platform.OS.toUpperCase()} DEBUG WORKBENCH
          </Text>
          <Text style={styles.title}>React Native App Updates Example</Text>
          <Text style={styles.description}>
            Use the controls below to switch between system app metadata and
            custom overrides, then exercise both the custom-provider demo and
            the official/native update paths.
          </Text>
        </View>

        <Card
          subtitle="These inputs sit above the whole page and are shared by the demo components below."
          title="App Context Controls"
        >
          <View style={debugStyles.fieldRow}>
            <Text style={debugStyles.fieldLabel}>System Metadata</Text>
            <Text style={styles.systemValue}>
              Version: {systemInfo?.version ?? 'Unavailable'}
            </Text>
            <Text style={styles.systemValue}>
              Bundle ID: {systemInfo?.identifier ?? 'Unavailable'}
            </Text>
            <Text style={styles.systemValue}>
              Build Number: {systemInfo?.buildNumber ?? 'Unavailable'}
            </Text>
            {systemInfoError ? (
              <Text style={debugStyles.warningText}>{systemInfoError}</Text>
            ) : null}
            <View style={styles.reloadActionRow}>
              <ActionButton
                label="Reload System Values"
                onPress={loadSystemInfo}
                variant="secondary"
              />
            </View>
          </View>

          <View style={debugStyles.fieldRow}>
            <Text style={debugStyles.fieldLabel}>Metadata Source</Text>
            <SegmentedToggle
              onChange={setOverrideMode}
              options={[
                { label: 'System', value: 'system' },
                { label: 'Override', value: 'override' },
              ]}
              value={overrideMode}
            />
            <Text style={debugStyles.helperText}>
              This single toggle applies to both the app version and the bundle
              identifier fields below.
            </Text>
          </View>

          <View style={debugStyles.fieldRow}>
            <Text style={debugStyles.fieldLabel}>Override Version</Text>
            <TextInput
              editable={overrideMode === 'override'}
              onChangeText={setVersionInput}
              placeholder="1.2.3"
              placeholderTextColor={palette.subtle}
              style={[
                styles.input,
                overrideMode !== 'override' && styles.inputDisabled,
              ]}
              value={versionInput}
            />
          </View>

          <View style={debugStyles.fieldRow}>
            <Text style={debugStyles.fieldLabel}>
              Override Bundle Identifier
            </Text>
            <TextInput
              autoCapitalize="none"
              editable={overrideMode === 'override'}
              onChangeText={setBundleIdInput}
              placeholder="com.example.app"
              placeholderTextColor={palette.subtle}
              style={[
                styles.input,
                overrideMode !== 'override' && styles.inputDisabled,
              ]}
              value={bundleIdInput}
            />
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>Effective Version</Text>
              <Text style={styles.summaryValue}>{effectiveVersion}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>Effective Bundle ID</Text>
              <Text style={styles.summaryValue}>{effectiveBundleId}</Text>
            </View>
          </View>
        </Card>

        <CustomProviderDemo
          bundleIdOverride={resolvedOverrides.bundleIdOverride}
          versionOverride={resolvedOverrides.versionOverride}
        />

        <OfficialDiagnosticsDemo
          bundleIdOverride={resolvedOverrides.bundleIdOverride}
          systemInfo={systemInfo}
          versionOverride={resolvedOverrides.versionOverride}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.background,
    flexGrow: 1,
    padding: 20,
  },
  description: {
    color: '#57534e',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 720,
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  hero: {
    marginBottom: 18,
  },
  input: {
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1,
    color: palette.text,
    fontSize: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputDisabled: {
    backgroundColor: '#f5f5f4',
    color: palette.subtle,
  },
  reloadActionRow: {
    marginTop: 10,
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  summaryLabel: {
    color: palette.subtle,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryPill: {
    backgroundColor: palette.accentMuted,
    borderRadius: 14,
    flex: 1,
    minWidth: 220,
    padding: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  summaryValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  systemValue: {
    color: palette.text,
    fontSize: 15,
    marginBottom: 4,
  },
  title: {
    color: palette.text,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 10,
  },
});
