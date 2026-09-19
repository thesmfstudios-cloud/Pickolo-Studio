import { getServiceClient } from '@/lib/supabase-admin';

export async function writeAdminAudit(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const serviceClient = getServiceClient();
  const { error } = await serviceClient.from('admin_audit_log').insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) throw new Error('Admin audit logging failed: ' + error.message);
}