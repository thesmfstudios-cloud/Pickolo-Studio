import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { colors, shadow } from './theme';

export function Page({
  children,
  scroll = true,
  bottomNav = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  bottomNav?: boolean;
}) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, bottomNav && styles.withNav]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, bottomNav && styles.withNav]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.safe}>
      {content}
      {bottomNav && <BottomNav />}
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  back = false,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {back && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.back}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {action}
      </View>
    </View>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <View>
      <Text style={[styles.brand, light && { color: '#fff' }]}>
        <Text style={{ color: colors.amber }}>P</Text> Pickolo
      </Text>
      <Text style={[styles.partner, light && { color: '#D8F4E5' }]}>
        PARTNER
      </Text>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        (pressed || disabled) && { opacity: 0.65 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant !== 'primary' && styles.buttonTextDark,
          variant === 'danger' && { color: colors.danger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  tone = 'green',
}: {
  label: string;
  tone?: 'green' | 'amber' | 'gray' | 'red';
}) {
  const toneStyle =
    tone === 'amber'
      ? styles.chipAmber
      : tone === 'red'
        ? styles.chipRed
        : tone === 'gray'
          ? styles.chipGray
          : styles.chipGreen;
  return <Text style={[styles.chip, toneStyle]}>{label}</Text>;
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function EmptyState({
  icon = '◌',
  title,
  body,
}: {
  icon?: string;
  title: string;
  body: string;
}) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </Card>
  );
}

export function RemoteState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (loading)
    return (
      <View style={{ padding: 28 }}>
        <ActivityIndicator color={colors.green} />
        <Text style={[ui.body, { textAlign: 'center', marginTop: 8 }]}>
          Loading…
        </Text>
      </View>
    );
  if (error)
    return (
      <Card>
        <Text style={ui.heading}>Unable to load</Text>
        <Text style={ui.body}>{error}</Text>
        <Button label="Try again" onPress={retry} />
      </Card>
    );
  return null;
}

const tabs = [
  { label: 'Home', icon: '⌂', path: '/home' },
  { label: 'Jobs', icon: '▣', path: '/jobs' },
  { label: 'Earnings', icon: '₹', path: '/earnings' },
  { label: 'Profile', icon: '●', path: '/profile' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.nav,
        {
          height: 70 + Math.max(insets.bottom, 12),
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.path}
            onPress={() => router.replace(tab.path)}
            style={styles.navItem}
          >
            <Text style={[styles.navIcon, active && styles.navActive]}>
              {tab.icon}
            </Text>
            <Text style={[styles.navLabel, active && styles.navActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 15,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 32 },
  withNav: { paddingBottom: 105 },
  header: { marginBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  backText: { fontSize: 30, lineHeight: 32, color: colors.ink },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 14, lineHeight: 20 },
  brand: {
    color: colors.greenDark,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  partner: {
    marginTop: 1,
    color: colors.green,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primary: { backgroundColor: colors.green },
  secondary: { backgroundColor: colors.greenSoft },
  danger: { backgroundColor: colors.dangerSoft },
  ghost: { backgroundColor: '#F2F4F3' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  buttonTextDark: { color: colors.greenDark },
  chip: {
    overflow: 'hidden',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
  },
  chipGreen: { color: colors.greenDark, backgroundColor: colors.greenSoft },
  chipAmber: { color: '#A14C00', backgroundColor: '#FFF2D6' },
  chipGray: { color: colors.text, backgroundColor: '#F1F3F2' },
  chipRed: { color: colors.danger, backgroundColor: colors.dangerSoft },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  empty: { marginTop: 12, alignItems: 'center', paddingVertical: 30 },
  emptyIcon: { fontSize: 34, color: colors.green },
  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  emptyBody: {
    marginTop: 6,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 82,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    ...shadow,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { color: '#98A2B3', fontSize: 21, fontWeight: '800' },
  navLabel: { marginTop: 3, color: '#667085', fontSize: 11, fontWeight: '700' },
  navActive: { color: colors.green },
});
