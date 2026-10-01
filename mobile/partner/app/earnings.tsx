import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  Chip,
  EmptyState,
  Header,
  Page,
  RemoteState,
  SectionTitle,
  ui,
} from '../ui/components';
import {
  isPaidPayout,
  money,
  Partner,
  Payout,
  Performance,
  request,
} from '../ui/api';
import { useRemote } from '../ui/useRemote';
import { colors } from '../ui/theme';

async function loadEarnings() {
  const [stats, profile] = await Promise.all([
    request<{ performance: Performance; payouts: Payout[] }>(
      '/api/partner/performance',
    ),
    request<{ partner: Partner }>('/api/partner/profile'),
  ]);
  return { ...stats, ...profile };
}
export default function EarningsScreen() {
  const remote = useRemote(loadEarnings);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const start =
    period === 'month'
      ? Date.parse(today.slice(0, 7) + '-01T00:00:00+05:30')
      : Date.parse(today + 'T00:00:00+05:30') - 6 * 86400000;
  const payouts = (remote.data?.payouts || []).filter(
    (p) => period === 'all' || Date.parse(p.created_at) >= start,
  );
  const total = (...statuses: string[]) =>
    payouts
      .filter((p) => statuses.includes(p.status))
      .reduce((sum, p) => sum + p.amount_paise, 0);
  return (
    <Page bottomNav>
      <Header title="Earnings" subtitle="Your actual payout records" />
      <View style={styles.tabs}>
        {(
          [
            ['week', 'LAST 7 DAYS'],
            ['month', 'THIS MONTH'],
            ['all', 'LATEST 100'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: period === key }}
            onPress={() => setPeriod(key)}
          >
            <Chip label={label} tone={period === key ? 'green' : 'gray'} />
          </Pressable>
        ))}
      </View>
      <RemoteState
        loading={remote.loading}
        error={remote.error}
        retry={remote.reload}
      />
      {remote.data && !remote.error && (
        <>
          <Card style={styles.hero}>
            <Text style={styles.heroLabel}>Released / processed payouts</Text>
            <Text style={styles.amount}>
              {money(total('released', 'processed'))}
            </Text>
            <Text style={styles.next}>
              Recorded when Pickolo releases your payout
            </Text>
          </Card>
          <SectionTitle>Payout summary</SectionTitle>
          <Card>
            <Row
              label="Pending / processing"
              value={money(total('pending', 'queued', 'processing'))}
            />
            <Row label="Approved" value={money(total('approved'))} />
            <Row
              label="Released / processed"
              value={money(total('released', 'processed'))}
            />
            <Text style={styles.note}>
              UPI account: {remote.data.partner.payout_upi_id || 'Not set'}. No
              withdrawal schedule has been published in the app.
            </Text>
          </Card>
          <SectionTitle>Payout history</SectionTitle>
          {payouts.length ? (
            payouts.map((p) => (
              <Card key={p.id} style={{ marginBottom: 12 }}>
                <View style={ui.between}>
                  <Text style={styles.value}>{money(p.amount_paise)}</Text>
                  <Chip
                    label={p.status.toUpperCase()}
                    tone={isPaidPayout(p) ? 'green' : 'amber'}
                  />
                </View>
                <Text style={styles.note}>
                  {new Date(p.created_at).toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                  })}
                </Text>
              </Card>
            ))
          ) : (
            <EmptyState
              title="No payout records yet"
              body="Payout records will appear as your completed work is processed."
            />
          )}
        </>
      )}
    </Page>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={ui.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  hero: { backgroundColor: colors.greenDark },
  heroLabel: { color: '#CFECDD', fontWeight: '700' },
  amount: { color: '#fff', fontSize: 38, fontWeight: '900', marginTop: 8 },
  next: { color: '#CFECDD', marginTop: 8 },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  value: { color: colors.ink, fontWeight: '900' },
  note: { color: colors.muted, marginTop: 14, lineHeight: 20, fontSize: 12 },
});
