'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminLogin() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  async function submit(event:FormEvent){
    event.preventDefault();
    if(!supabase){setMessage('Supabase is not configured.');return;}
    setBusy(true); setMessage('');
    const result=await supabase.auth.signInWithPassword({email:email.trim(),password});
    setBusy(false);
    if(result.error){setMessage(result.error.message);return;}
    const profile=await supabase.from('profiles').select('role').eq('id',result.data.user?.id ?? '').single();
    if(profile.data?.role!=='admin'){
      await supabase.auth.signOut();
      setMessage('This account does not have admin access.');
      return;
    }
    window.location.href='/admin';
  }

  return <main className="main"><div className="container"><div className="kicker">Pickolo operations</div><h1 style={{fontSize:48,margin:'8px 0 10px'}}>Admin sign in</h1><p className="muted">Restricted access for authorized operators.</p><div className="card" style={{maxWidth:520,marginTop:20}}><form className="form" onSubmit={submit}><input className="input" type="email" placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)} required/><input className="input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="button" type="submit" disabled={busy}>{busy?'Signing in...':'Sign in'}</button>{message&&<p className="muted">{message}</p>}</form></div></div></main>;
}
