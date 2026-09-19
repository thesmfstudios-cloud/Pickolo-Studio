'use client';
import { FormEvent, useState } from 'react';

export default function CustomerPage() {
  const [submitted, setSubmitted] = useState(false);
  function submit(e: FormEvent) { e.preventDefault(); setSubmitted(true); }
  return <main className="main"><div className="container"><div className="kicker">Customer</div><h1 style={{fontSize:48,margin:'8px 0 10px'}}>Create a photography booking</h1><p className="muted">Mobile-first booking form for the Pickolo pilot.</p><div className="card" style={{maxWidth:720,marginTop:20}}>
    {submitted ? <div><span className="badge">Request created</span><h2>Booking is ready for backend integration.</h2><p className="muted">Next step is payment confirmation, assignment and live booking status.</p></div> : <form className="form" onSubmit={submit}>
      <div className="row"><input className="input" placeholder="Service" defaultValue="Photography" disabled/><select className="input" defaultValue="Standard"><option>Basic</option><option>Standard</option><option>Professional</option></select></div>
      <div className="row"><input className="input" type="date" required/><input className="input" type="time" required/></div>
      <div className="row"><select className="input" defaultValue="60"><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option></select><input className="input" placeholder="Location / landmark" required/></div>
      <input className="input" type="tel" placeholder="Customer phone" required/>
      <button className="button" type="submit">Continue to price</button>
    </form>}
  </div></div></main>;
}
