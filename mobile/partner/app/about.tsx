import { Text } from 'react-native';
import Constants from 'expo-constants';
import { Card, Header, Page, SectionTitle, ui } from '../ui/components';
export default function About() {
  return (
    <Page>
      <Header title="About Pickolo" subtitle="Photography, made local" back />
      <Card>
        <Text style={ui.heading}>Pickolo Partner</Text>
        <Text style={[ui.body, { marginTop: 9 }]}>
          Pickolo connects verified photographers and videographers with
          customers across Bhopal. This partner app manages assignments, shoot
          progress, secure delivery and earnings.
        </Text>
      </Card>
      <SectionTitle>Privacy & partner information</SectionTitle>
      <Card>
        <Text style={ui.heading}>Partner responsibilities</Text>
        <Text style={[ui.body, { marginTop: 8 }]}>
          Keep availability accurate, accept assignments you can fulfil and
          deliver work through Pickolo. Your signed partner agreement governs
          assignments and payouts.
        </Text>
        <Text style={[ui.heading, { marginTop: 20 }]}>Private files</Text>
        <Text style={[ui.body, { marginTop: 8 }]}>
          Identity documents and delivered files are stored privately for
          verification and booking fulfilment. A complete, reviewed privacy
          policy and legal terms must be published before public release.
        </Text>
      </Card>
      <Text style={[ui.body, { textAlign: 'center', marginTop: 20 }]}>
        Version {Constants.expoConfig?.version || '—'}
      </Text>
    </Page>
  );
}
