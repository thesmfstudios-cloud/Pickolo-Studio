import { BOOKING_STATES } from '@/types/pickolo';

export default function AdminPage() {
  return <main className="main"><div className="container"><div className="kicker">Admin control room</div><h1 style={{fontSize:48,margin:'8px 0 10px'}}>Pickolo operations</h1><p className="muted">Manual intervention remains possible while automation grows around it.</p><div className="grid" style={{marginTop:20}}>{[['Pending bookings','4'],['Active jobs','2'],['Verified partners','23']].map(([label,val])=><div className="card" key={label}><div className="stat">{val}</div><div className="muted">{label}</div></div>)}</div>
  <section className="section card"><h2>Booking state machine</h2><table className="table"><thead><tr><th>#</th><th>State</th><th>Purpose</th></tr></thead><tbody>{BOOKING_STATES.map((s,i)=><tr key={s}><td>{i+1}</td><td><strong>{s}</strong></td><td className="muted">Controlled transaction stage</td></tr>)}</tbody></table></section>
  </div></main>;
}
