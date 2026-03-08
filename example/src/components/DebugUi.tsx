import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export const palette = {
  accent: '#0f766e',
  accentMuted: '#ccfbf1',
  background: '#f5f5f4',
  border: '#d6d3d1',
  card: '#ffffff',
  codeBackground: '#111827',
  codeText: '#e5e7eb',
  subtle: '#57534e',
  success: '#15803d',
  text: '#1c1917',
  warning: '#b45309',
};

export const debugStyles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtonLabelPrimary: {
    color: '#ffffff',
  },
  actionButtonLabelSecondary: {
    color: palette.accent,
  },
  actionButtonPrimary: {
    backgroundColor: palette.accent,
  },
  actionButtonSecondary: {
    backgroundColor: palette.card,
    borderColor: palette.accent,
    borderWidth: 1,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  cardSubtitle: {
    color: palette.subtle,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  codeBlock: {
    backgroundColor: palette.codeBackground,
    borderRadius: 12,
    marginTop: 8,
    padding: 12,
  },
  codeText: {
    color: palette.codeText,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  fieldLabel: {
    color: palette.subtle,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  fieldRow: {
    marginBottom: 14,
  },
  helperText: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  segmentedControl: {
    backgroundColor: '#e7e5e4',
    borderRadius: 12,
    flexDirection: 'row',
    padding: 4,
  },
  segmentedOption: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentedOptionActive: {
    backgroundColor: palette.card,
  },
  segmentedOptionLabel: {
    color: palette.subtle,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentedOptionLabelActive: {
    color: palette.text,
  },
  statusText: {
    color: palette.success,
    fontSize: 14,
    fontWeight: '600',
  },
  warningText: {
    color: palette.warning,
    fontSize: 14,
    fontWeight: '600',
  },
});

type ActionButtonVariant = 'primary' | 'secondary';

interface ActionButtonProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => Promise<void> | void;
  readonly variant?: ActionButtonVariant;
}

export function ActionButton({
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: ActionButtonProps) {
  function handlePress() {
    if (disabled) {
      return;
    }

    const result = onPress();
    if (result && typeof result.then === 'function') {
      result.catch(() => undefined);
    }
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={handlePress}
      style={[
        debugStyles.actionButton,
        variant === 'primary'
          ? debugStyles.actionButtonPrimary
          : debugStyles.actionButtonSecondary,
        disabled && debugStyles.actionButtonDisabled,
      ]}
    >
      <Text
        style={[
          debugStyles.actionButtonLabel,
          variant === 'primary'
            ? debugStyles.actionButtonLabelPrimary
            : debugStyles.actionButtonLabelSecondary,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface CardProps {
  readonly children: ReactNode;
  readonly subtitle?: string;
  readonly title: string;
}

export function Card({ children, subtitle, title }: CardProps) {
  return (
    <View style={debugStyles.card}>
      <Text style={debugStyles.cardTitle}>{title}</Text>
      {subtitle ? (
        <Text style={debugStyles.cardSubtitle}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}

interface ResultBlockProps {
  readonly fallback?: string;
  readonly title: string;
  readonly value: unknown;
}

export function ResultBlock({
  fallback = 'No data yet.',
  title,
  value,
}: ResultBlockProps) {
  return (
    <View style={debugStyles.fieldRow}>
      <Text style={debugStyles.fieldLabel}>{title}</Text>
      <View style={debugStyles.codeBlock}>
        <Text style={debugStyles.codeText}>
          {formatDebugValue(value, fallback)}
        </Text>
      </View>
    </View>
  );
}

interface SegmentedToggleOption<TValue extends string> {
  readonly label: string;
  readonly value: TValue;
}

interface SegmentedToggleProps<TValue extends string> {
  readonly onChange: (value: TValue) => void;
  readonly options: readonly SegmentedToggleOption<TValue>[];
  readonly value: TValue;
}

export function SegmentedToggle<TValue extends string>({
  onChange,
  options,
  value,
}: SegmentedToggleProps<TValue>) {
  return (
    <View style={debugStyles.segmentedControl}>
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              debugStyles.segmentedOption,
              active && debugStyles.segmentedOptionActive,
            ]}
          >
            <Text
              style={[
                debugStyles.segmentedOptionLabel,
                active && debugStyles.segmentedOptionLabelActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function formatDebugValue(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}
