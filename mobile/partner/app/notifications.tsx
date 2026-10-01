import { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Header,
  Page,
  RemoteState,
  ui,
} from '../ui/components';
import { errorMessage, request } from '../ui/api';
import { useRemote } from '../ui/useRemote';
type Notice = {
  id: string;
  title: string;
  body: string;
  booking_id?: string | null;
  read_at?: string | null;
  created_at: string;
};
async function loadNotices() {
  return request<{ notifications: Notice[] }>('/api/notifications');
}
export default function PartnerNotifications() {
  const remote = useRemote(loadNotices);
  const [busy, setBusy] = useState(false);
  async function openNotice(item: Notice) {
    setBusy(true);
    try {
      if (!item.read_at)
        await request('/api/notifications/read', {
          method: 'POST',
          body: JSON.stringify({ id: item.id }),
        });
      await remote.reload();
      if (item.booking_id) router.push('/jobs');
    } catch (err) {
      Alert.alert('Unable to open notification', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Header
        title="Notifications"
        subtitle="Job updates and account activity"
        back
      />
      <RemoteState
        loading={remote.loading}
        error={remote.error}
        retry={remote.reload}
      />
      {!remote.loading &&
        !remote.error &&
        (remote.data?.notifications.length ? (
          remote.data.notifications.map((item) => (
            <Pressable
              disabled={busy}
              key={item.id}
              onPress={() => {
                void openNotice(item);
              }}
            >
              <Card style={{ marginBottom: 12 }}>
                <Text style={ui.heading}>{item.title}</Text>
                {!item.read_at && <Chip label="NEW" />}
                <Text style={[ui.body, { marginTop: 8 }]}>{item.body}</Text>
                <Text style={[ui.body, { marginTop: 10, fontSize: 12 }]}>
                  {new Date(item.created_at).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                  })}
                </Text>
              </Card>
            </Pressable>
          ))
        ) : (
          <EmptyState
            title="You're up to date"
            body="New assignment and account updates will appear here."
          />
        ))}
      <Button
        label="Refresh notifications"
        variant="secondary"
        disabled={remote.loading}
        onPress={remote.reload}
      />
    </Page>
  );
}
