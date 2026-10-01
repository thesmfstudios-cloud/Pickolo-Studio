import { Text } from 'react-native';
import { router } from 'expo-router';
import { Application, request } from '../ui/api';
import { useRemote } from '../ui/useRemote';
import { Button, Card, Header, Page, RemoteState, ui } from '../ui/components';

async function loadApplication() {
  return request<{ application: Application | null }>(
    '/api/partner/application',
  );
}
export default function Verification() {
  const remote = useRemote(loadApplication);
  const application = remote.data?.application;
  const status = application?.status;
  const title =
    status === 'approved'
      ? 'Application approved'
      : status === 'rejected'
        ? 'Application needs attention'
        : application
          ? 'Application under review'
          : 'Complete your application';
  return (
    <Page>
      <Header title="Verification" subtitle="Your current application status" />
      <RemoteState
        loading={remote.loading}
        error={remote.error}
        retry={remote.reload}
      />
      {!remote.loading && !remote.error && (
        <>
          <Card>
            <Text style={ui.heading}>{title}</Text>
            <Text style={[ui.body, { marginTop: 12 }]}>
              {status === 'rejected'
                ? application?.rejection_reason ||
                  'Contact Pickolo support for review details.'
                : status === 'approved'
                  ? 'Your application was approved. Account access is checked when you open your workspace.'
                  : application
                    ? 'Pickolo will notify you when your review is complete. You can check again below.'
                    : 'Add your details and UPI account before submitting verification documents.'}
            </Text>
          </Card>
          <Button
            label="Check status again"
            variant="secondary"
            onPress={remote.reload}
          />
          {status === 'approved' ? (
            <Button
              label="Open workspace"
              onPress={() => router.replace('/home')}
            />
          ) : status !== 'rejected' ? (
            <Button
              label={
                application
                  ? 'Update application & documents'
                  : 'Start application'
              }
              onPress={() => router.push('/apply')}
            />
          ) : (
            <Button
              label="Help & support"
              onPress={() => router.push('/support')}
            />
          )}
        </>
      )}
    </Page>
  );
}
