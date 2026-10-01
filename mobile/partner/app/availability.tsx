import { useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Header,
  Page,
  RemoteState,
  SectionTitle,
  ui,
} from '../ui/components';
import { errorMessage, request } from '../ui/api';
import { useRemote } from '../ui/useRemote';
type Slot = {
  id: string;
  starts_at: string;
  ends_at: string;
  available: boolean;
};
async function loadAvailability() {
  return request<{ availability: Slot[] }>('/api/partner/availability');
}
export default function AvailabilityScreen() {
  const remote = useRemote(loadAvailability);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  async function addSlot() {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)
    )
      return Alert.alert(
        'Invalid availability',
        'Use YYYY-MM-DD and 24-hour HH:MM times.',
      );
    const begins = new Date(date + 'T' + start + ':00+05:30');
    const finishes = new Date(date + 'T' + end + ':00+05:30');
    if (
      Number.isNaN(begins.getTime()) ||
      finishes <= begins ||
      begins <= new Date() ||
      begins.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) !== date
    )
      return Alert.alert(
        'Invalid availability',
        'Use a valid future date with the end after the start.',
      );
    setBusy(true);
    try {
      await request('/api/partner/availability', {
        method: 'POST',
        body: JSON.stringify({
          starts_at: begins.toISOString(),
          ends_at: finishes.toISOString(),
        }),
      });
      setDate('');
      setStart('');
      setEnd('');
      await remote.reload();
    } catch (err) {
      Alert.alert('Unable to save', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Header
        title="Availability"
        subtitle="Plan your Bhopal shoots · times in IST"
        back
      />
      <Card>
        <Text style={ui.heading}>Add a time window</Text>
        <TextInput
          style={[ui.input, { marginTop: 12 }]}
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
        />
        <TextInput
          style={[ui.input, { marginTop: 10 }]}
          placeholder="Start HH:MM"
          value={start}
          onChangeText={setStart}
        />
        <TextInput
          style={[ui.input, { marginTop: 10 }]}
          placeholder="End HH:MM"
          value={end}
          onChangeText={setEnd}
        />
        <Button
          label={busy ? 'Saving…' : 'Add time window'}
          onPress={addSlot}
          disabled={busy}
        />
      </Card>
      <SectionTitle>Your windows</SectionTitle>
      <RemoteState
        loading={remote.loading}
        error={remote.error}
        retry={remote.reload}
      />
      {!remote.loading &&
        !remote.error &&
        (remote.data?.availability.length ? (
          remote.data.availability.map((slot) => (
            <Card key={slot.id} style={{ marginBottom: 12 }}>
              <Text style={ui.label}>
                {new Date(slot.starts_at).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })}
              </Text>
              <Text style={ui.body}>
                until{' '}
                {new Date(slot.ends_at).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })}{' '}
                IST
              </Text>
              <Chip label={slot.available ? 'AVAILABLE' : 'UNAVAILABLE'} />
            </Card>
          ))
        ) : (
          <EmptyState
            title="No availability yet"
            body="Add the hours you are ready to accept assignments."
          />
        ))}
    </Page>
  );
}
