"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Icon, { IconName } from "@/components/customer-icon";
import { supabaseBrowser } from "@/lib/supabase-browser";
export default function CustomerHome() {
  const [service, setService] = useState("Photography");
  const [avatar, setAvatar] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState(false);
  useEffect(() => {
    supabaseBrowser.auth.getUser().then(({ data }) => {
      const u = data.user;
      setName(u?.user_metadata?.full_name || u?.user_metadata?.name || "");
      setAvatar(u?.user_metadata?.avatar_url || "");
    });
  }, []);
  return (
    <main className="premium-home">
      <header className="premium-header">
        <div>
          <Link className="premium-logo" href="/customer">
            PICKOLO
          </Link>
          <button
            className="area-chip"
            onClick={() => setArea(!area)}
            aria-expanded={area}
          >
            <Icon name="pin" size={17} /> Bhopal · Rohit Nagar <span>⌄</span>
          </button>
        </div>
        <Link
          href="/customer/profile"
          className="premium-avatar"
          aria-label="Open your profile"
        >
          {avatar ? (
            <img src={avatar} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span>
              {name ? name.slice(0, 1).toUpperCase() : <Icon name="user" />}
            </span>
          )}
        </Link>
      </header>
      {area && (
        <section className="premium-card area-info" role="status">
          <strong>We’re capturing Bhopal.</strong>
          <p>
            Available within 15 km of Rohit Nagar. Add your exact venue when
            planning your shoot.
          </p>
          <button className="text-button" onClick={() => setArea(false)}>
            Got it
          </button>
        </section>
      )}
      <section className="premium-hero">
        <div className="hero-copy">
          <span className="eyebrow">MADE FOR YOUR MOMENTS</span>
          <h1>
            Hi, let’s capture
            <br />
            something
            <br />
            beautiful.
          </h1>
          <span className="gold-rule" />
          <p>
            Real moments. Beautiful stories.
            <br />
            Captured by trusted creators
            <br />
            near you.
          </p>
        </div>
        <Image
          width={1280}
          height={1280}
          preload
          sizes="(max-width: 640px) 58vw, 460px"
          className="hero-art"
          src="/assets/pickolo-hero.png"
          alt="A vintage camera with instant photographs of a sunset and a couple"
        />
      </section>
      <section className="premium-card service-picker">
        <h2>What do you need?</h2>
        <div className="premium-services">
          {(["Photography", "Videography", "Both"] as const).map((s, i) => (
            <button
              key={s}
              className={service === s ? "selected" : ""}
              aria-pressed={service === s}
              onClick={() => setService(s)}
            >
              <span className="service-art">
                <Icon
                  name={(["camera", "video", "both"] as IconName[])[i]}
                  size={38}
                />
              </span>
              <strong>{s}</strong>
            </button>
          ))}
        </div>
        <Link
          className="customer-primary"
          href={"/customer/new?service=" + service}
        >
          Book a shoot <Icon name="arrow" />
        </Link>
      </section>
      <section className="premium-trust" aria-label="Booking benefits">
        {(
          [
            ["shield", "Verified", "creators"],
            ["calendar", "Easy", "booking"],
            ["card", "Pay after", "shoot available"],
          ] as [IconName, string, string][]
        ).map(([icon, a, b]) => (
          <div key={a}>
            <Icon name={icon} size={28} />
            <span>
              {a}
              <br />
              {b}
            </span>
          </div>
        ))}
      </section>
      <section className="premium-how">
        <h2>How it works</h2>
        <div>
          {(
            [
              ["camera", "Choose", "Pick your coverage"],
              ["calendar", "Book", "Set a time and place"],
              ["camera", "Capture", "Meet your creator"],
            ] as [IconName, string, string][]
          ).map(([icon, title, sub], i) => (
            <div key={title}>
              <span className="step-circle">{i + 1}</span>
              <Icon name={icon} size={36} />
              <strong>{title}</strong>
              <small>{sub}</small>
            </div>
          ))}
        </div>
      </section>
      <p className="home-note">
        Original files included. Editing and retouching are not included.
      </p>
    </main>
  );
}
