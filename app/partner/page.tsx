'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

type App = { display_name: string; phone: string; bio: string|null; skills: string[]; status: string; rejection_reason: string|null };
type Partner = { partner_code: string; verification_status: string; service_level_id: string|null; base_lat: number|null; base_long: number|null };
type Job = { id: string; booking_code: string; status: string; partner_acceptance_status: string|null; scheduled_start: string; duration_minutes: number; location_text: string; notes: string|null; service?: {name?:string|null}|null; service_level?:{name?:string|null}|null };
type Slot = { id:string; starts_at:string; ends_at:string; available:boolean };

const readJson = async (r: Response) => { const t=await r.text(); try{return t?JSON.parse(t):{}}catch{return{}} };

export default function PartnerPage() {
  const [session,setSession]=useState<any>(null);
  const [mode,setMode]=useState<'login'|'signup'>('login');
  const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const [name,setName]=useState(''); const [phone,setPhone]=useState('');
  const [bio,setBio]=useState(''); const [skills,setSkills]=useState('');
  const [app,setApp]=useState<App|null>(null); const [partner,setPartner]=useState<Partner|null>(null);
  const [jobs,setJobs]=useState<Job[]>([]); const [slots,setSlots]=useState<Slot[]>([]);
  const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false);
  const [date,setDate]=useState(''); const [start,setStart]=useState(''); const [end,setEnd]=useState('');

  const load=useCallback(async(token:string)=>{
    const h={Authorization:'Bearer '+token};
    const [a,p]=await Promise.all([
      fetch('/api/partner/application',{headers:h,cache:'no-store'}),
      fetch('/api/partner/profile',{headers:h,cache:'no-store'})
    ]);
    const ad=await readJson(a), pd=await readJson(p);
    setApp(ad.application??null);
    if(!p.ok){setPartner(null);setJobs([]);setSlots([]);return;}
    setPartner(pd.partner??null);
    const [j,s]=await Promise.all([
      fetch('/api/partner/jobs',{headers:h,cache:'no-store'}),
      fetch('/api/partner/availability',{headers:h,cache:'no-store'})
    ]);
    const jd=await readJson(j), sd=await readJson(s);
    if(j.ok)setJobs(jd.jobs??[]); if(s.ok)setSlots(sd.availability??[]);
  },[]);

  useEffect(()=>{
    if(!supabaseBrowser)return;
    supabaseBrowser.auth.getSession().then(({data})=>{
      if(data.session){setSession(data.session);load(data.session.access_token);}
    });
    const {data}=supabaseBrowser.auth.onAuthStateChange((_e,s)=>{
      setSession(s);
      if(s)load(s.access_token); else {setApp(null);setPartner(null);setJobs([]);setSlots([]);}
    });
    return()=>data.subscription.unsubscribe();
  },[load]);

  async function auth(e:FormEvent){
    e.preventDefault(); setBusy(true); setMsg('');
    const r=mode==='login'
      ? await supabaseBrowser!.auth.signInWithPassword({email,password})
      : await supabaseBrowser!.auth.signUp({email,password,options:{data:{full_name:name}}});
    if(r.error)setMsg(r.error.message);
    else if(!r.data.session)setMsg('Account created. Complete email confirmation if required, then login.');
    setBusy(false);
  }

  async function apply(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!session)return; setBusy(true); setMsg('');
    try{
      const r=await fetch('/api/partner/apply',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({display_name:name,phone,bio,skills:skills.split(',').map(s=>s.trim()).filter(Boolean)})});
      const d=await readJson(r); if(!r.ok)throw new Error(d.error||'Application failed');
      setApp(d.application); setMsg('Application submitted. Admin verification is required.');
    }catch(e){setMsg(e instanceof Error?e.message:'Application failed');}finally{setBusy(false);}
  }

  async function location(){
    if(!session||!navigator.geolocation)return; setBusy(true); setMsg('');
    try{
      const p=await new Promise<GeolocationPosition>((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:10000}));
      const r=await fetch('/api/partner/profile',{method:'PATCH',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({base_lat:p.coords.latitude,base_long:p.coords.longitude})});
      const d=await readJson(r); if(!r.ok)throw new Error(d.error||'Location update failed');
      setPartner(d.partner); setMsg('Base location saved for 5 KM matching.');
    }catch(e){setMsg(e instanceof Error?e.message:'Location update failed');}finally{setBusy(false);}
  }

  async function addSlot(e:FormEvent){
    e.preventDefault(); if(!session)return; setBusy(true); setMsg('');
    try{
      const r=await fetch('/api/partner/availability',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({starts_at:new Date(date+'T'+start).toISOString(),ends_at:new Date(date+'T'+end).toISOString(),available:true})});
      const d=await readJson(r); if(!r.ok)throw new Error(d.error||'Availability failed');
      setSlots(x=>[...x,d.availability]); setMsg('Availability added.');
    }catch(e){setMsg(e instanceof Error?e.message:'Availability failed');}finally{setBusy(false);}
  }

  async function respond(job:Job,action:'accept'|'decline'){
    if(!session)return; setBusy(true); setMsg('');
    try{
      const r=await fetch('/api/partner/jobs/'+encodeURIComponent(job.id)+'/respond',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action})});
      const d=await readJson(r); if(!r.ok)throw new Error(d.error||'Assignment update failed');
      setMsg(action==='accept'?'Assignment accepted.':'Assignment declined. Matching will continue.'); await load(session.access_token);
    }catch(e){setMsg(e instanceof Error?e.message:'Assignment update failed');}finally{setBusy(false);}
  }

  if(!session) return <main className="main"><div className="container"><div className="kicker">Partner</div><h1 style={{fontSize:48,margin:'8px 0 10px'}}>{mode==='login'?'Partner login':'Join as a photographer'}</h1><p className="muted">Real partner authentication and onboarding.</p><div className="card" style={{maxWidth:560,marginTop:20}}><form className="form" onSubmit={auth}>{mode==='signup'&&<input className="input" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} required/>}<input className="input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/><input className="input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required/><button className="button" disabled={busy}>{busy?'Please wait…':mode==='login'?'Login':'Create partner account'}</button>{msg&&<p className="muted">{msg}</p>}</form><button className="button secondary" style={{marginTop:18}} onClick={()=>{setMode(mode==='login'?'signup':'login');setMsg('')}}>{mode==='login'?'Create a partner account':'Already have an account? Login'}</button></div></div></main>;

  if(!partner) return <main className="main"><div className="container"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div className="kicker">Partner onboarding</div><h1 style={{fontSize:48,margin:'8px 0 10px'}}>Apply as a photographer</h1><p className="muted">{session.user.email}</p></div><button className="button secondary" onClick={()=>supabaseBrowser?.auth.signOut()}>Sign out</button></div><div className="card" style={{maxWidth:720,marginTop:20}}>{app?<><span className="badge">{app.status.toUpperCase()}</span><h2>Application status</h2><p className="muted">{app.status==='rejected'?app.rejection_reason||'Application rejected.':'Waiting for admin verification.'}</p><button className="button secondary" onClick={()=>load(session.access_token)}>Refresh status</button></>:<form className="form" onSubmit={apply}><input className="input" placeholder="Photographer / studio name" value={name} onChange={e=>setName(e.target.value)} required/><input className="input" placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} required/><input className="input" placeholder="Skills, comma separated" value={skills} onChange={e=>setSkills(e.target.value)}/><textarea className="input" placeholder="Bio" rows={4} value={bio} onChange={e=>setBio(e.target.value)}/><button className="button" disabled={busy}>Submit application</button></form>}{msg&&<p className="muted" style={{marginTop:16}}>{msg}</p>}</div></div></main>;

  return <main className="main"><div className="container"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div className="kicker">Partner</div><h1 style={{fontSize:48,margin:'8px 0 10px'}}>Photographer workspace</h1><p className="muted">{session.user.email}</p></div><button className="button secondary" onClick={()=>supabaseBrowser?.auth.signOut()}>Sign out</button></div><div className="grid" style={{marginTop:20}}><div className="card"><span className="badge">{partner.verification_status.toUpperCase()}</span><h2>Partner profile</h2><p className="muted">Partner ID: {partner.partner_code}</p><p className="muted">Service level ID: {partner.service_level_id||'Pending'}</p><button className="button secondary" onClick={location} disabled={busy}>{partner.base_lat!==null?'Update base location':'Set base location'}</button></div><div className="card"><span className="badge">{jobs.length} JOBS</span><h2>Assignments</h2><p className="muted">Only assignments belonging to this partner are shown.</p></div><div className="card"><span className="badge">{slots.filter(s=>s.available).length} WINDOWS</span><h2>Availability</h2><p className="muted">Future availability used by automatic matching.</p></div></div><section className="section card"><h2>Incoming jobs</h2>{jobs.length===0?<p className="muted">No assigned jobs yet.</p>:jobs.map(job=><div key={job.id} className="card" style={{margin:'12px 0 0'}}><span className="badge">{job.status}</span><h3>{job.service?.name||'Photography'} · {job.service_level?.name||'Service level'}</h3><p className="muted">{job.booking_code} · {job.duration_minutes} min · {new Date(job.scheduled_start).toLocaleString()}</p><p>{job.location_text}</p>{job.notes&&<p className="muted">{job.notes}</p>}{job.status==='PARTNER_ASSIGNED'&&job.partner_acceptance_status==='pending'&&<div style={{display:'flex',gap:10,marginTop:12}}><button className="button" disabled={busy} onClick={()=>respond(job,'accept')}>Accept job</button><button className="button secondary" disabled={busy} onClick={()=>respond(job,'decline')}>Decline</button></div>}</div>)}</section><section className="section card"><h2>Add availability</h2><form className="form" onSubmit={addSlot}><div className="row"><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} required/><input className="input" type="time" value={start} onChange={e=>setStart(e.target.value)} required/></div><div className="row"><input className="input" type="time" value={end} onChange={e=>setEnd(e.target.value)} required/><button className="button" disabled={busy}>Add window</button></div></form>{slots.length>0&&<table className="table" style={{marginTop:16}}><tbody>{slots.map(s=><tr key={s.id}><th>{s.available?'Available':'Blocked'}</th><td>{new Date(s.starts_at).toLocaleString()} → {new Date(s.ends_at).toLocaleString()}</td></tr>)}</tbody></table>}</section>{msg&&<p className="muted">{msg}</p>}</div></main>;
}
