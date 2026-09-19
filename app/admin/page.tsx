'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Booking = {
  id: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  customer_price_paise: number;
  assigned_partner_id: string | null;
  service?: { name?: string | null } | null;
  service_level?: { name?: string | null } | null;
};

type Application = {
  id: string;
  applicant_id: string;
  display_name: string;
  phone: string;
  status: string;
  skills: string[];
  created_at: string;
};

type Partner = {
  id: string;
  partner_code: string;
  verification_status: string;
  service_level?: { name?: string | null } | null;
};

type PartnerDocument = {
  id: string;
  partner_id: string;
  document_type: string;
  file_name: string;
  mime_type: string | null;
  status: string;
  rejection_reason: string | null;
  signed_url?: string | null;
  created_at: string;
};

type Dispute = {
  id: string;
  booking_id: string;
  reason_code: string;
  description: string;
  status: string;
  resolution: string | null;
  created_at: string;
};

type Metrics = {
  bookings: { total: number; paid: number; active: number; completed: number; cancelled: number; completionRate: number };
  money: { gmvPaise: number; platformRevenuePaise: number; partnerPayoutsPaise: number; payoutsReleasedPaise: number };
};

type PriceConfig = {
  id: string;
  duration_minutes: number;
  amount_paise: number;
  platform_fee_bps: number;
  service_level?: { name?: string | null } | null;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [pricing, setPricing] = useState<PriceConfig[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [documents, setDocuments] = useState<PartnerDocument[]>([]);
  const [message, setMessage] = useState('');
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const token = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    const accessToken = await token();
    if (!accessToken) {
      window.location.href = '/admin/login';
      return;
    }

    const profile = await supabase!.from('profiles').select('role').eq('id', (await supabase!.auth.getUser()).data.user?.id ?? '').single();
    if (profile.data?.role !== 'admin') {
      window.location.href = '/admin/login';
      return;
    }

    setAuthorized(true);

    const headers = { Authorization: 'Bearer ' + accessToken };
    const [bookingRes, appRes, partnerRes, pricingRes, disputeRes, documentRes, metricsRes] = await Promise.all([
      fetch('/api/admin/bookings', { headers }),
      fetch('/api/admin/partners?status=pending', { headers }),
      fetch('/api/admin/partner-directory', { headers }),
      fetch('/api/admin/pricing', { headers }),
      fetch('/api/admin/disputes?status=open', { headers }),
      fetch('/api/admin/partner-documents?status=pending', { headers }),
      fetch('/api/admin/metrics', { headers }),
    ]);

    const [bookingData, appData, partnerData, pricingData, disputeData, documentData, metricsData] = await Promise.all([
      bookingRes.json().catch(() => ({})),
      appRes.json().catch(() => ({})),
      partnerRes.json().catch(() => ({})),
      pricingRes.json().catch(() => ({})),
      disputeRes.json().catch(() => ({})),
      documentRes.json().catch(() => ({})),
      metricsRes.json().catch(() => ({})),
    ]);

    if (!bookingRes.ok) setMessage(bookingData.error || 'Unable to load bookings.');
    setBookings(bookingData.bookings || []);
    setApplications(appData.applications || []);
    setPartners(partnerData.partners || []);
    setPricing(pricingData.pricing || []);
    setDisputes(disputeData.disputes || []);
    setDocuments(documentData.documents || []);
    setMetrics(metricsData);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function verifyApplication(id: string, action: 'approve' | 'reject') {
    const accessToken = await token();
    if (!accessToken) return;
    const response = await fetch('/api/admin/partners/' + id + '/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
      body: JSON.stringify({ action }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || 'Verification failed.');
      return;
    }
    await load();
  }

  async function savePrice(id: string, amountPaise: number, platformFeeBps: number) {
    const accessToken = await token();
    if (!accessToken) return;

    setSavingPriceId(id);
    const response = await fetch('/api/admin/pricing', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({
        id,
        amount_paise: amountPaise,
        platform_fee_bps: platformFeeBps,
      }),
    });

    const result = await response.json().catch(() => ({}));
    setSavingPriceId(null);

    if (!response.ok) {
      setMessage(result.error || 'Unable to save pricing.');
      return;
    }

    await load();
  }

  async function assign(bookingId: string, partnerId: string) {
    const accessToken = await token();
    if (!accessToken || !partnerId) return;

    const response = await fetch('/api/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
      body: JSON.stringify({ booking_id: bookingId, partner_id: partnerId }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || 'Assignment failed.');
      return;
    }
    await load();
  }

  async function postAdmin(path: string, body?: Record<string, unknown>) {
    const accessToken = await token();
    if (!accessToken) return false;

    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || 'Operation failed.');
      return false;
    }

    await load();
    return true;
  }

  async function logout() {
    await supabase?.auth.signOut();
    window.location.href = '/admin/login';
  }

  if (loading) return <main className="main"><div className="container"><p className="muted">Loading operations...</p></div></main>;
  if (!authorized) return null;

  const pendingBookings = bookings.filter((item) => ['REQUESTED', 'PAYMENT_CONFIRMED', 'SEARCHING_PARTNER'].includes(item.status));

  return (
    <main className="main">
      <div className="container">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'end',gap:20}}>
          <div>
            <div className="kicker">Admin control room</div>
            <h1 style={{fontSize:48,margin:'8px 0 10px'}}>Pickolo operations</h1>
            <p className="muted">Bookings, partner verification and assignment.</p>
          </div>
          <button className="button secondary" onClick={logout}>Logout</button>
        </div>

        {message && <div className="card section"><strong>Attention</strong><p className="muted">{message}</p></div>}

        <section className="grid section">
          <div className="card"><div className="stat">{pendingBookings.length}</div><div className="muted">Needs operations</div></div>
          <div className="card"><div className="stat">{applications.length}</div><div className="muted">Pending partner applications</div></div>
          <div className="card"><div className="stat">{partners.filter((p) => p.verification_status === 'approved').length}</div><div className="muted">Approved partners</div></div>
        </section>

        <section className="grid section">
          <div className="card"><div className="stat">₹{((metrics?.money.gmvPaise ?? 0) / 100).toLocaleString()}</div><div className="muted">GMV</div></div>
          <div className="card"><div className="stat">₹{((metrics?.money.platformRevenuePaise ?? 0) / 100).toLocaleString()}</div><div className="muted">Platform revenue</div></div>
          <div className="card"><div className="stat">{Math.round((metrics?.bookings.completionRate ?? 0) * 100)}%</div><div className="muted">Completion rate</div></div>
        </section>

        <section className="card section">
          <h2>Partner applications</h2>
          {applications.length === 0 ? <p className="muted">No pending applications.</p> : applications.map((app) => (
            <div key={app.id} style={{padding:'16px 0',borderBottom:'1px solid var(--line)'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'start'}}>
                <div>
                  <strong>{app.display_name}</strong>
                  <div className="muted">{app.phone}</div>
                  <div className="muted">{app.skills?.join(', ') || 'No skills listed'}</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="button" onClick={() => verifyApplication(app.id,'approve')}>Approve</button>
                  <button className="button secondary" onClick={() => verifyApplication(app.id,'reject')}>Reject</button>
                </div>
              </div>
            </div>
          ))}
        </section>



        <section className="card section">
          <h2>Verification documents</h2>
          {documents.length === 0 ? <p className="muted">No pending verification documents.</p> : documents.map((doc) => (
            <div key={doc.id} style={{padding:'16px 0',borderBottom:'1px solid var(--line)'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'start'}}>
                <div>
                  <strong>{doc.file_name}</strong>
                  <div className="muted">Partner {doc.partner_id}</div>
                  <div className="muted">{doc.document_type} · {doc.mime_type || 'file'}</div>
                  <div className="muted">Submitted {new Date(doc.created_at).toLocaleString()}</div>
                  {doc.signed_url && <a className="button secondary" style={{marginTop:8}} href={doc.signed_url} target="_blank" rel="noreferrer">Review file</a>}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="button" onClick={() => postAdmin('/api/admin/partner-documents', { id: doc.id, status: 'approved' })}>Approve</button>
                  <button className="button secondary" onClick={() => postAdmin('/api/admin/partner-documents', { id: doc.id, status: 'rejected', rejection_reason: 'Document requires correction.' })}>Reject</button>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="card section">
          <h2>Pricing configuration</h2>
          <p className="muted">Server-side prices used by new bookings. Values are in INR.</p>
          <table className="table">
            <thead><tr><th>Level</th><th>Duration</th><th>Customer price</th><th>Platform fee</th></tr></thead>
            <tbody>
              {pricing.map((item) => (
                <tr key={item.id}>
                  <td>{item.service_level?.name || '—'}</td>
                  <td>{item.duration_minutes} min</td>
                  <td>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input
                        className="input"
                        style={{width:110}}
                        type="number"
                        min="100"
                        defaultValue={(item.amount_paise / 100).toFixed(0)}
                        id={'price-' + item.id}
                      />
                      <button
                        className="button secondary"
                        disabled={savingPriceId === item.id}
                        onClick={() => {
                          const el = document.getElementById('price-' + item.id) as HTMLInputElement | null;
                          const rupees = Number(el?.value || 0);
                          savePrice(item.id, Math.round(rupees * 100), item.platform_fee_bps);
                        }}
                      >
                        {savingPriceId === item.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{width:90}}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      defaultValue={(item.platform_fee_bps / 100).toFixed(1)}
                      id={'fee-' + item.id}
                      onBlur={(e) => {
                        const fee = Number(e.target.value);
                        const el = document.getElementById('price-' + item.id) as HTMLInputElement | null;
                        const rupees = Number(el?.value || item.amount_paise / 100);
                        if (Number.isFinite(fee) && Number.isFinite(rupees) && fee >= 0 && fee <= 100) {
                          savePrice(item.id, Math.round(rupees * 100), Math.round(fee * 100));
                        }
                      }}
                    />
                    <span className="muted">%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card section">
          <h2>Open support cases</h2>
          {disputes.length === 0 ? <p className="muted">No open disputes.</p> : disputes.map((dispute) => (
            <div key={dispute.id} style={{padding:'16px 0',borderBottom:'1px solid var(--line)'}}>
              <strong>{dispute.reason_code}</strong>
              <div className="muted">Booking {dispute.booking_id}</div>
              <p>{dispute.description}</p>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button className="button secondary" onClick={() => postAdmin('/api/admin/disputes', { id: dispute.id, status: 'under_review' })}>Review</button>
                <button className="button" onClick={() => postAdmin('/api/admin/disputes', { id: dispute.id, status: 'resolved', resolution: 'Issue reviewed and resolved by Pickolo operations.' })}>Resolve</button>
                <button className="button secondary" onClick={() => postAdmin('/api/admin/disputes', { id: dispute.id, status: 'rejected', resolution: 'Case reviewed and rejected by Pickolo operations.' })}>Reject</button>
              </div>
            </div>
          ))}
        </section>

        <section className="card section">
          <h2>Booking queue</h2>
          <table className="table">
            <thead><tr><th>Booking</th><th>Status</th><th>Schedule</th><th>Level</th><th>Assignment</th><th>Operations</th></tr></thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td><strong>{booking.booking_code}</strong><div className="muted">{booking.location_text}</div></td>
                  <td>{booking.status}</td>
                  <td>{new Date(booking.scheduled_start).toLocaleString()}</td>
                  <td>{booking.service_level?.name || '—'}</td>
                  <td>
                    {booking.assigned_partner_id ? <span className="badge">ASSIGNED</span> : (
                      <select className="input" style={{minWidth:220}} defaultValue="" onChange={(e) => assign(booking.id, e.target.value)}>
                        <option value="" disabled>Assign partner...</option>
                        {partners.filter((p) => p.verification_status === 'approved').map((partner) => (
                          <option key={partner.id} value={partner.id}>{partner.partner_code} · {partner.service_level?.name || 'Standard'}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {booking.assigned_partner_id && ['PARTNER_ASSIGNED','ON_THE_WAY'].includes(booking.status) && (
                        <button className="button secondary" onClick={() => postAdmin('/api/admin/no-show/' + booking.id, { reason: 'Partner no-show recorded by admin.' })}>No-show</button>
                      )}
                      {booking.status === 'CUSTOMER_CONFIRMED' && (
                        <button className="button" onClick={() => postAdmin('/api/admin/payouts/' + booking.id + '/release')}>Release payout</button>
                      )}
                      {booking.status === 'PAYOUT_RELEASED' && (
                        <button className="button" onClick={() => postAdmin('/api/bookings/' + booking.id + '/transition', { to_status: 'COMPLETED' })}>Complete booking</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
