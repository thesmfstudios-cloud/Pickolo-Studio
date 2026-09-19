export default function PartnerPage() {
  return <main className="main"><div className="container"><div className="kicker">Partner</div><h1 style={{fontSize:48,margin:'8px 0 10px'}}>Photographer workspace</h1><p className="muted">Availability, jobs and the controlled completion flow.</p><div className="grid" style={{marginTop:20}}>
    <div className="card"><span className="badge">VERIFIED</span><h2>Partner profile</h2><p className="muted">Service level: Standard</p><p className="muted">Partner ID: PKL-DEMO-001</p></div>
    <div className="card"><span className="badge">2 JOBS</span><h2>Today</h2><p className="muted">One upcoming photography assignment.</p></div>
    <div className="card"><span className="badge">AVAILABLE</span><h2>Status</h2><p className="muted">Ready for nearby jobs inside the active radius.</p></div>
  </div>
  <section className="section card"><h2>Incoming job</h2><table className="table"><tbody><tr><th>Service</th><td>Photography · Standard</td></tr><tr><th>Duration</th><td>1 hour</td></tr><tr><th>Location</th><td>Local pilot area</td></tr><tr><th>Status</th><td>SEARCHING_PARTNER</td></tr></tbody></table><div style={{display:'flex',gap:10,marginTop:16}}><button className="button">Accept job</button><button className="button secondary">Decline</button></div></section>
  </div></main>;
}
