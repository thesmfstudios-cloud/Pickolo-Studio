import { StyleSheet, Text, View } from 'react-native';
import { Header, Card, Chip, Page, SectionTitle, ui } from '../ui/components';
import { colors } from '../ui/theme';

export default function EarningsScreen() {
  return <Page bottomNav><Header title="Earnings" subtitle="Payouts and completed-shoot earnings" />
    <View style={styles.tabs}><Chip label="THIS WEEK" /><Chip label="THIS MONTH" tone="gray" /><Chip label="ALL TIME" tone="gray" /></View>
    <Card style={styles.hero}><Text style={styles.heroLabel}>Available earnings</Text><Text style={styles.amount}>₹1,850</Text><Text style={styles.next}>Next payout · Friday, 2 Oct</Text></Card>
    <View style={styles.stats}><Card style={styles.stat}><Text style={styles.statValue}>3</Text><Text style={ui.body}>Shoots</Text></Card><Card style={styles.stat}><Text style={styles.statValue}>₹617</Text><Text style={ui.body}>Avg. per shoot</Text></Card></View>
    <SectionTitle>Earnings breakdown</SectionTitle><Card><Row label="Shoot payouts" value="₹1,650" /><Row label="Quality bonus" value="₹200" /><Row label="Deductions" value="₹0" /><View style={styles.total}><Text style={styles.totalLabel}>Total earnings</Text><Text style={styles.totalValue}>₹1,850</Text></View></Card>
    <SectionTitle>Recent payouts</SectionTitle><Card><Row label="24 Sep · UPI" value="₹2,400" /><Row label="17 Sep · UPI" value="₹1,750" /><Text style={styles.note}>Payout account and transfer status come from your verified partner profile.</Text></Card>
  </Page>;
}
function Row({ label, value }: { label: string; value: string }) { return <View style={styles.row}><Text style={ui.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>; }
const styles = StyleSheet.create({ tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 }, hero: { backgroundColor: colors.greenDark }, heroLabel: { color: '#CFECDD', fontWeight: '700' }, amount: { color: '#fff', fontSize: 38, fontWeight: '900', marginTop: 8 }, next: { color: '#CFECDD', marginTop: 8 }, stats: { flexDirection: 'row', gap: 12, marginTop: 14 }, stat: { flex: 1 }, statValue: { color: colors.ink, fontSize: 24, fontWeight: '900' }, row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line }, value: { color: colors.ink, fontWeight: '900' }, total: { marginHorizontal: -18, marginBottom: -18, marginTop: 8, padding: 18, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, backgroundColor: colors.greenSoft, flexDirection: 'row', justifyContent: 'space-between' }, totalLabel: { color: colors.greenDark, fontWeight: '900' }, totalValue: { color: colors.greenDark, fontWeight: '900', fontSize: 17 }, note: { color: colors.muted, marginTop: 14, lineHeight: 20, fontSize: 12 } });
