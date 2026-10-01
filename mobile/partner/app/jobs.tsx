import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { errorMessage, isActiveJob, Job, request } from '../ui/api';
import { useRemote } from '../ui/useRemote';
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

const NEXT_ACTION: Record<string, { label: string; to: string }> = {
  PARTNER_ASSIGNED: { label: 'Mark on the way', to: 'ON_THE_WAY' },
  ON_THE_WAY: { label: 'Start shoot', to: 'SHOOT_STARTED' },
  SHOOT_STARTED: { label: 'Complete shoot', to: 'SHOOT_COMPLETED' },
  SHOOT_COMPLETED: { label: 'Prepare delivery', to: 'DATA_PENDING' },
};
async function loadJobs() {
  return request<{ jobs: Job[] }>('/api/partner/jobs');
}
export default function PartnerJobsScreen() {
  const remote = useRemote(loadJobs);
  const [bookingOtp, setBookingOtp] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'offers' | 'history'>('active');
  const jobs = (remote.data?.jobs || []).filter((j) =>
    tab === 'offers'
      ? j.status === 'PARTNER_ASSIGNED' &&
        j.partner_acceptance_status === 'pending'
      : tab === 'active'
        ? isActiveJob(j) && j.partner_acceptance_status !== 'pending'
        : !isActiveJob(j),
  );

  async function run(job: Job, path: string, body: unknown) {
    if (busyId) return;
    setBusyId(job.id);
    try {
      await request(path, { method: 'POST', body: JSON.stringify(body) });
      setBookingOtp((v) => ({ ...v, [job.id]: '' }));
      await remote.reload();
    } catch (err) {
      Alert.alert('Action failed', errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }
  function transition(job: Job) {
    const action = NEXT_ACTION[job.status];
    if (!action) return;
    if (
      action.to === 'SHOOT_STARTED' &&
      !/^\d{6}$/.test(bookingOtp[job.id] || '')
    )
      return Alert.alert(
        'Customer OTP required',
        'Ask the customer for their six-digit booking OTP.',
      );
    void run(job, '/api/bookings/' + job.id + '/transition', {
      to_status: action.to,
      ...(action.to === 'SHOOT_STARTED'
        ? { booking_otp: bookingOtp[job.id] }
        : {}),
    });
  }
  function cancel(job: Job) {
    Alert.alert(
      'Cancel assignment?',
      'Pickolo will reassign this shoot. Cancellation may affect your reliability record.',
      [
        { text: 'Keep assignment', style: 'cancel' },
        {
          text: 'Cancel assignment',
          style: 'destructive',
          onPress: () => {
            void run(job, '/api/partner/jobs/' + job.id + '/cancel', {
              reason: 'Partner cancelled the assignment.',
            });
          },
        },
      ],
    );
  }
  return (
    <Page bottomNav>
      <Header
        title="Jobs"
        subtitle="Your photography & videography assignments"
      />
      <View style={styles.tabs}>
        {(['active', 'offers', 'history'] as const).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
          >
            <Chip
              label={key === 'offers' ? 'OPEN OFFERS' : key.toUpperCase()}
              tone={tab === key ? 'green' : 'gray'}
            />
          </Pressable>
        ))}
      </View>
      <RemoteState
        loading={remote.loading}
        error={remote.error}
        retry={remote.reload}
      />
      {!remote.loading &&
        !remote.error &&
        (jobs.length ? (
          jobs.map((job) => {
            const pending =
              job.status === 'PARTNER_ASSIGNED' &&
              job.partner_acceptance_status === 'pending';
            const expired =
              pending &&
              job.partner_offer_expires_at &&
              Date.parse(job.partner_offer_expires_at) <= Date.now();
            const action = NEXT_ACTION[job.status];
            const accepted =
              job.partner_acceptance_status === 'accepted' ||
              job.partner_acceptance_status === 'not_required';
            return (
              <Card key={job.id} style={{ marginTop: 14 }}>
                <View style={ui.between}>
                  <Text style={ui.label}>{job.booking_code}</Text>
                  <Chip label={job.status.replaceAll('_', ' ')} tone="amber" />
                </View>
                <Text style={[ui.heading, { marginTop: 14 }]}>
                  {job.service?.name || 'Photography'}
                </Text>
                <Text style={ui.body}>
                  {new Date(job.scheduled_start).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                  })}{' '}
                  · {job.duration_minutes} min
                </Text>
                <Text style={ui.body}>
                  {job.service_level?.name || 'Standard'} · {job.location_text}
                </Text>
                {job.notes && (
                  <Text style={[ui.body, { marginTop: 8 }]}>{job.notes}</Text>
                )}
                {pending && (
                  <Text style={[ui.body, { marginTop: 10 }]}>
                    {expired
                      ? 'Offer expired. Refresh to check your assignments.'
                      : job.partner_offer_expires_at
                        ? 'Respond before ' +
                          new Date(
                            job.partner_offer_expires_at,
                          ).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                          })
                        : 'New assignment offer'}
                  </Text>
                )}
                {pending && (
                  <>
                    <Button
                      label={busyId === job.id ? 'Working…' : 'Accept job'}
                      disabled={!!busyId || !!expired}
                      onPress={() => {
                        void run(
                          job,
                          '/api/partner/jobs/' + job.id + '/respond',
                          { action: 'accept' },
                        );
                      }}
                    />
                    <Button
                      label="Pass"
                      variant="secondary"
                      disabled={!!busyId || !!expired}
                      onPress={() => {
                        void run(
                          job,
                          '/api/partner/jobs/' + job.id + '/respond',
                          {
                            action: 'decline',
                            reason: 'Partner declined the assignment.',
                          },
                        );
                      }}
                    />
                  </>
                )}
                {accepted && isActiveJob(job) && (
                  <>
                    <Button
                      label="Navigate to shoot ↗"
                      variant="secondary"
                      onPress={() => {
                        const location =
                          job.location_lat != null && job.location_long != null
                            ? job.location_lat + ',' + job.location_long
                            : job.location_text;
                        void Linking.openURL(
                          'https://www.google.com/maps/search/?api=1&query=' +
                            encodeURIComponent(location),
                        ).catch(() =>
                          Alert.alert(
                            'Maps unavailable',
                            'Unable to open navigation.',
                          ),
                        );
                      }}
                    />
                    {job.status === 'ON_THE_WAY' && (
                      <>
                        <Text style={[ui.label, { marginTop: 16 }]}>
                          Customer booking OTP
                        </Text>
                        <TextInput
                          accessibilityLabel="Customer booking OTP"
                          style={[ui.input, { marginTop: 8 }]}
                          keyboardType="number-pad"
                          maxLength={6}
                          placeholder="Six-digit OTP"
                          value={bookingOtp[job.id] || ''}
                          onChangeText={(value) =>
                            setBookingOtp((v) => ({
                              ...v,
                              [job.id]: value.replace(/\D/g, '').slice(0, 6),
                            }))
                          }
                        />
                      </>
                    )}
                    {action && (
                      <Button
                        label={busyId === job.id ? 'Updating…' : action.label}
                        disabled={!!busyId}
                        onPress={() => transition(job)}
                      />
                    )}
                    {job.status === 'DATA_PENDING' && (
                      <Button
                        label="Upload delivery"
                        disabled={!!busyId}
                        onPress={() =>
                          router.push({
                            pathname: '/delivery',
                            params: { id: job.id },
                          })
                        }
                      />
                    )}
                    {['PARTNER_ASSIGNED', 'ON_THE_WAY'].includes(
                      job.status,
                    ) && (
                      <Button
                        label="Cancel assignment"
                        variant="danger"
                        disabled={!!busyId}
                        onPress={() => cancel(job)}
                      />
                    )}
                  </>
                )}
              </Card>
            );
          })
        ) : (
          <EmptyState
            title={
              tab === 'offers'
                ? 'No open offers'
                : tab === 'history'
                  ? 'No job history yet'
                  : 'No active assignments'
            }
            body="Eligible assignments and updates appear here. Check again when you are available."
          />
        ))}
      <Button
        label="Refresh jobs"
        variant="secondary"
        onPress={remote.reload}
        disabled={remote.loading}
      />
    </Page>
  );
}
const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
