import { Alert, Linking, StyleSheet, Text } from 'react-native';
import { Button, Card, Header, Page, SectionTitle, ui } from '../ui/components';
export default function Support() {
  const phone = process.env.EXPO_PUBLIC_SUPPORT_PHONE?.replace(/[\s-]/g, '');
  const canCall = !!phone && /^\+?\d{7,15}$/.test(phone);
  return (
    <Page>
      <Header
        title="Help & support"
        subtitle="We are here for every shoot"
        back
      />
      <Card>
        <Text style={styles.title}>Need help on a shoot?</Text>
        <Text style={ui.body}>
          {canCall
            ? 'Contact Partner Support with your booking code ready.'
            : 'A support helpline has not been published in this app yet. Use your existing Pickolo onboarding contact.'}
        </Text>
        {canCall && (
          <Button
            label="Call partner support"
            onPress={() => {
              void Linking.openURL('tel:' + phone).catch(() =>
                Alert.alert(
                  'Call unavailable',
                  'Unable to open your phone dialler.',
                ),
              );
            }}
          />
        )}
      </Card>
      <SectionTitle>Common questions</SectionTitle>
      <Card>
        <Text style={styles.q}>How do I start a shoot?</Text>
        <Text style={ui.body}>
          Accept the assignment, mark On the way, then enter the customer OTP at
          the location before starting.
        </Text>
        <Text style={styles.q}>When are payouts processed?</Text>
        <Text style={ui.body}>
          Your payout records and their current status appear in Earnings.
          Confirm the payout schedule with Pickolo operations.
        </Text>
        <Text style={styles.q}>How do I deliver my work?</Text>
        <Text style={ui.body}>
          After completing the shoot, tap Prepare delivery, select final photos
          and videos, then upload them securely.
        </Text>
      </Card>
    </Page>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '900', marginBottom: 8 },
  q: { marginTop: 16, marginBottom: 5, fontWeight: '900' },
});
