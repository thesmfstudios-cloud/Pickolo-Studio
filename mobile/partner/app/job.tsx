import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Header, Page } from '../ui/components';
import { JobsWorkspace } from './jobs';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  if (typeof id !== 'string' || !id)
    return (
      <Page>
        <Header title="Assignment details" back />
        <EmptyState
          title="No assignment selected"
          body="Open an assignment from Home or Jobs to see its details."
        />
      </Page>
    );
  return <JobsWorkspace detailId={id} />;
}
