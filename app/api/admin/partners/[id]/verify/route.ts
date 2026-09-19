import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!url || !anonKey) throw new Error('Supabase environment is not configured.');
    const authorization = request.headers.get('authorization') ?? '';
    const supabase = createClient(url, anonKey, {
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: admin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const { id } = await context.params;
    const body = await request.json();
    const action = body?.action as 'approve' | 'reject' | 'suspend' | undefined;
    const rejectionReason = String(body?.rejection_reason || '').slice(0, 500);

    if (!action || !['approve', 'reject', 'suspend'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve, reject or suspend.' }, { status: 400 });
    }

    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      suspend: 'suspended',
    } as const;

    const nextStatus = statusMap[action];

    const { data: application, error: applicationError } = await supabase
      .from('partner_applications')
      .select('id,applicant_id,display_name,phone,bio,skills,base_lat,base_long,status')
      .eq('id', id)
      .single();

    if (applicationError || !application) {
      return NextResponse.json({ error: 'Partner application not found.' }, { status: 404 });
    }

    const { data: existingLevel } = await supabase
      .from('service_levels')
      .select('id')
      .eq('name', 'Standard')
      .single();

    if (action === 'approve' && !existingLevel) {
      return NextResponse.json({ error: 'Default partner service level is unavailable.' }, { status: 500 });
    }

    if (action === 'approve') {
      const generatedCode = 'PKL-' + String(application.applicant_id).replace(/-/g, '').slice(0, 8).toUpperCase();

      const { error: partnerError } = await supabase.from('partners').upsert({
        id: application.applicant_id,
        partner_code: generatedCode,
        verification_status: 'approved',
        service_level_id: existingLevel!.id,
        bio: application.bio,
        base_lat: application.base_lat,
        base_long: application.base_long,
      }, { onConflict: 'id' });

      if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 400 });

      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'partner', full_name: application.display_name, phone: application.phone })
        .eq('id', application.applicant_id);

      if (roleError) return NextResponse.json({ error: roleError.message }, { status: 400 });
    }

    if (action === 'reject' || action === 'suspend') {
      await supabase
        .from('partners')
        .update({ verification_status: nextStatus })
        .eq('id', application.applicant_id);
    }

    const { data: updated, error: updateError } = await supabase
      .from('partner_applications')
      .update({
        status: nextStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: action === 'reject' ? rejectionReason || 'Application not approved.' : null,
      })
      .eq('id', id)
      .select('id,applicant_id,status,reviewed_by,reviewed_at,rejection_reason')
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    return NextResponse.json({ application: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
