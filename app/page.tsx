import Link from 'next/link';

export default function Home() {
  return (
    <main className="main">
      <div className="container">
        <section className="hero">
          <div>
            <div className="kicker">On-demand photography marketplace</div>
            <h1>Book the right photographer. Complete the job.</h1>
            <p>Pickolo starts as a controlled local marketplace for short photography assignments. This build is the foundation for the customer flow, partner workflow and admin control room.</p>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:20}}>
              <Link className="button" href="/customer">Open Customer</Link>
              <Link className="button secondary" href="/admin">Open Admin</Link>
            </div>
          </div>
          <div className="card">
            <span className="badge">MVP v0.1</span>
            <div className="section">
              <h2>Current target</h2>
              <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                <div><div className="stat">5 KM</div><div className="muted">pilot radius</div></div>
                <div><div className="stat">20–25</div><div className="muted">verified partners</div></div>
                <div><div className="stat">100</div><div className="muted">paid bookings</div></div>
                <div><div className="stat">3</div><div className="muted">service levels</div></div>
              </div>
            </div>
          </div>
        </section>
        <section className="section card">
          <h2>Core transaction loop</h2>
          <div className="steps">
            {['Request','Price & payment','Partner assignment','Shoot','Data delivery','Customer confirmation','Payout & review'].map((s,i)=><div className="step" key={s}><span className="step-no">{i+1}</span><span>{s}</span></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
