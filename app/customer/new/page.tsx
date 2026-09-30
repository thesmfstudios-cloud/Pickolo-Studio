"use client";
import { CSSProperties, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/customer-icon";
import VenueMap from "@/components/venue-map";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { customerApi } from "@/lib/customer-api";
import { DURATIONS, LEVELS, RAW_POLICY, rupees } from "@/lib/customer";
type Item = { id: string; name: string };
const names = ["Photography", "Videography", "Both"];
export default function PlanShoot() {
  const router = useRouter();
  const [services, setServices] = useState<Item[]>([]);
  const [levels, setLevels] = useState<Item[]>([]);
  const [service, setService] = useState("Photography");
  const [level, setLevel] = useState(1);
  const [duration, setDuration] = useState(120);
  const [when, setWhen] = useState("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [notes, setNotes] = useState("");
  const [ack, setAck] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [error, setError] = useState("");
  const [quotes, setQuotes] = useState<{
    key: string;
    values: Record<string, number | null>;
    errors: Record<string, string>;
  }>({ key: "", values: {}, errors: {} });
  const pricingKey = service + ":" + duration;
  const price =
    quotes.key === pricingKey ? (quotes.values[LEVELS[level]] ?? null) : null;
  const priceError =
    quotes.key === pricingKey ? quotes.errors[LEVELS[level]] || "" : "";
  const [ready, setReady] = useState(false);
  const [payment, setPayment] = useState("upfront");
  async function loadOptions() {
    setError("");
    try {
      const [a, b] = await Promise.all([
        supabaseBrowser.from("services").select("id,name").eq("active", true),
        supabaseBrowser
          .from("service_levels")
          .select("id,name")
          .eq("active", true),
      ]);
      if (a.error || b.error)
        throw new Error("Booking options could not load. Please retry.");
      setServices(a.data || []);
      setLevels(b.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your connection.");
    }
  }
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "service",
    );
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("pickolo-draft") || "null",
      );
      if (saved) {
        setService(saved.service || "Photography");
        setLevel(saved.level ?? 1);
        setDuration(saved.duration || 120);
        setWhen(saved.when || "now");
        setDate(saved.date || "");
        setTime(saved.time || "");
        setAddress(saved.address || "");
        setLat(saved.lat || "");
        setLng(saved.lng || "");
        setNotes(saved.notes || "");
      }
    } catch {}
    if (requested && names.includes(requested)) setService(requested);
    setReady(true);
    loadOptions();
  }, []);
  useEffect(() => {
    if (ready)
      sessionStorage.setItem(
        "pickolo-draft",
        JSON.stringify({
          service,
          level,
          duration,
          when,
          date,
          time,
          address,
          lat,
          lng,
          notes,
        }),
      );
  }, [
    ready,
    service,
    level,
    duration,
    when,
    date,
    time,
    address,
    lat,
    lng,
    notes,
  ]);
  useEffect(() => {
    const controller = new AbortController();
    const s = services.find((s) => s.name === service);
    if (!s) return;
    setQuotes({ key: pricingKey, values: {}, errors: {} });
    Promise.all(
      LEVELS.map(async (name) => {
        try {
          const r = await fetch(
            "/api/pricing?" +
              new URLSearchParams({
                level: name,
                duration: String(duration),
                service: s.id,
              }),
            { signal: controller.signal },
          );
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Price unavailable.");
          if (!Number.isSafeInteger(d.totalPaise) || d.totalPaise <= 0)
            throw new Error("Price unavailable.");
          return { name, price: d.totalPaise as number, error: "" };
        } catch (e) {
          return {
            name,
            price: null,
            error: e instanceof Error ? e.message : "Price unavailable.",
          };
        }
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      setQuotes({
        key: pricingKey,
        values: Object.fromEntries(results.map((r) => [r.name, r.price])),
        errors: Object.fromEntries(results.map((r) => [r.name, r.error])),
      });
    });
    return () => controller.abort();
  }, [services, service, duration, pricingKey]);
  async function locate() {
    setLocating(true);
    setError("");
    try {
      const p = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
        }),
      );
      setLat(String(p.coords.latitude));
      setLng(String(p.coords.longitude));
    } catch {
      setError(
        "Location could not be read. Allow location access or add your venue’s map coordinates below.",
      );
    } finally {
      setLocating(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const s = services.find((s) => s.name === service),
      l = levels.find((l) => l.name === LEVELS[level]);
    const latitude = Number(lat),
      longitude = Number(lng);
    if (!s || !l || price === null) {
      setError("Wait for live pricing or retry loading options.");
      return;
    }
    if (
      !lat.trim() ||
      !lng.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      setError("Add a valid location pin for your shoot venue.");
      return;
    }
    if (address.trim().length < 3) {
      setError("Enter your shoot address.");
      return;
    }
    const start =
      when === "now"
        ? new Date(Date.now() + 60000)
        : new Date(date + "T" + time + "+05:30");
    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      setError("Choose a future date and time in India time.");
      return;
    }
    if (step === 1) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!ack) {
      setError("Please accept the original-file policy.");
      return;
    }
    setBusy(true);
    try {
      const r = await customerApi("/api/bookings", {
        service_id: s.id,
        service_level_id: l.id,
        scheduled_start: start.toISOString(),
        duration_minutes: duration,
        location_text: address.trim(),
        location_lat: latitude,
        location_long: longitude,
        notes,
        raw_data_acknowledged: true,
      });
      sessionStorage.removeItem("pickolo-draft");
      if (payment === "after_shoot") {
        try {
          await customerApi(
            "/api/bookings/" + r.booking.id + "/pay-after-shoot",
            {},
          );
        } catch {
          router.push(
            "/customer/booking?id=" + r.booking.id + "&deferred=retry",
          );
          return;
        }
      }
      router.push("/customer/booking?id=" + r.booking.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to create your booking.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="premium-plan">
      <header className="plan-header">
        <button
          type="button"
          className="icon-button"
          aria-label={step === 2 ? "Edit shoot details" : "Back to home"}
          onClick={() => (step === 2 ? setStep(1) : router.push("/customer"))}
        >
          <Icon name="back" />
        </button>
        <Link href="/customer" className="premium-logo">
          PICKOLO
        </Link>
        <span className="step-indicator">
          Step {step} of 2
          <i>
            <b />
            <b className={step === 2 ? "filled" : ""} />
          </i>
        </span>
      </header>
      <div className="plan-title">
        <h1>
          {step === 1
            ? "Plan your " +
              (service === "Both" ? "photo & video" : service.toLowerCase()) +
              " shoot"
            : "Review your booking"}
        </h1>
        <p>
          {step === 1
            ? "It only takes a minute."
            : "Your moment, just the way you planned it."}
        </p>
      </div>
      <form onSubmit={submit}>
        {step === 1 ? (
          <>
            <fieldset className="plan-section">
              <legend>Coverage</legend>
              <div className="segments">
                {names.map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={service === n ? "selected" : ""}
                    aria-pressed={service === n}
                    onClick={() => setService(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="plan-section">
              <legend>When?</legend>
              <div className="segments when-options">
                {[
                  ["now", "Book now"],
                  ["later", "Schedule later"],
                ].map(([v, label]) => (
                  <button
                    type="button"
                    key={v}
                    className={when === v ? "selected" : ""}
                    aria-pressed={when === v}
                    onClick={() => setWhen(v)}
                  >
                    <Icon name={v === "now" ? "bolt" : "calendar"} />
                    {label}
                  </button>
                ))}
              </div>
              {when === "later" ? (
                <div className="field-row">
                  <label>
                    Date
                    <input
                      className="input"
                      type="date"
                      min={new Date().toLocaleDateString("en-CA", {
                        timeZone: "Asia/Kolkata",
                      })}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Time · IST
                    <input
                      className="input"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      required
                    />
                  </label>
                </div>
              ) : (
                <p className="helper">
                  Arrival time is confirmed when a nearby creator accepts.
                </p>
              )}
            </fieldset>
            <fieldset className="plan-section">
              <legend>How long?</legend>
              <div className="duration-row">
                {DURATIONS.map((d) => (
                  <button
                    type="button"
                    key={d}
                    className={d === duration ? "selected" : ""}
                    aria-pressed={d === duration}
                    onClick={() => setDuration(d)}
                  >
                    {d / 60} hr{d > 60 ? "s" : ""}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="plan-section">
              <legend>Choose your experience</legend>
              <div className="experience-selector">
                <div className="experience-heading">
                  <div className="experience-choice">
                    <span className="experience-symbol">
                      <Icon
                        name={
                          service === "Videography"
                            ? "video"
                            : service === "Both"
                              ? "both"
                              : "camera"
                        }
                        size={28}
                      />
                    </span>
                    <div>
                      <strong className="experience-name">
                        {LEVELS[level]}
                      </strong>
                      {level === 1 && (
                        <span className="experience-popular">Most popular</span>
                      )}
                    </div>
                  </div>
                  <div
                    className="experience-total"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <strong>
                      {price === null
                        ? priceError
                          ? "Unavailable"
                          : "Checking…"
                        : rupees(price)}
                    </strong>
                    <small>
                      Total for {duration / 60}{" "}
                      {duration === 60 ? "hour" : "hours"}
                    </small>
                  </div>
                </div>
                <div className="experience-track">
                  <span className="experience-stop start" aria-hidden="true" />
                  <span className="experience-stop end" aria-hidden="true" />
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="1"
                    value={level}
                    aria-label="Choose your experience"
                    aria-valuetext={
                      LEVELS[level] +
                      (price === null
                        ? ", price unavailable"
                        : ", " +
                          rupees(price) +
                          " total for " +
                          duration / 60 +
                          " hours")
                    }
                    aria-describedby="experience-slider-help"
                    style={
                      { "--slider-fill": `${level * 50}%` } as CSSProperties
                    }
                    onChange={(e) => setLevel(Number(e.target.value))}
                  />
                </div>
                <div className="experience-tier-prices">
                  {LEVELS.map((l, i) => {
                    const tierPrice =
                      quotes.key === pricingKey ? quotes.values[l] : null;
                    return (
                      <button
                        type="button"
                        key={l}
                        className={level === i ? "selected" : ""}
                        aria-pressed={level === i}
                        onClick={() => setLevel(i)}
                      >
                        <strong>{l}</strong>
                        <span>
                          {tierPrice != null
                            ? rupees(tierPrice)
                            : quotes.key === pricingKey && quotes.errors[l]
                              ? "Unavailable"
                              : "…"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p
                  id="experience-slider-help"
                  className="experience-slider-help"
                >
                  Slide to compare experience and price
                </p>
              </div>
            </fieldset>
            <section className="plan-section">
              <h2>Shoot location</h2>
              <label className="location-input">
                <Icon name="pin" />
                <input
                  placeholder="Venue, street and landmark"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  minLength={3}
                  maxLength={300}
                  required
                  aria-label="Shoot address"
                />
              </label>
              <button
                type="button"
                className="location-button"
                onClick={() => setMapOpen(true)}
              >
                <Icon name="pin" size={18} />
                {lat && lng ? "Change venue on map" : "Choose venue on map"}
              </button>
              <button
                type="button"
                className="location-button"
                disabled={locating}
                onClick={locate}
              >
                <Icon name={lat && lng ? "check" : "pin"} size={18} />
                {locating
                  ? "Finding your location…"
                  : lat && lng
                    ? "Use current location instead"
                    : "Use my current location"}
              </button>
              <p className="helper">
                Available within 15 km of Rohit Nagar, Bhopal. Use current
                location only at the shoot venue.
              </p>
              <details>
                <summary>Advanced · enter coordinates manually</summary>
                <div className="field-row">
                  <label>
                    Latitude
                    <input
                      className="input"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      className="input"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                    />
                  </label>
                </div>
                <p className="helper">
                  Copy the coordinates from the venue’s map pin.
                </p>
              </details>
              <label className="field-label">
                Special requests <span className="helper">Optional</span>
                <textarea
                  className="input"
                  rows={2}
                  maxLength={1800}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="An occasion, a landmark, a little inspiration…"
                />
              </label>
            </section>
          </>
        ) : (
          <>
            <section className="premium-card">
              <h2>Your shoot</h2>
              <dl className="summary-list">
                <dt>Coverage</dt>
                <dd>
                  {service} · {LEVELS[level]}
                </dd>
                <dt>When</dt>
                <dd>
                  {when === "now"
                    ? "As soon as available"
                    : date + " · " + time + " IST"}
                </dd>
                <dt>Duration</dt>
                <dd>{duration / 60} hours</dd>
                <dt>Venue</dt>
                <dd>{address}</dd>
                {notes && (
                  <>
                    <dt>Requests</dt>
                    <dd>{notes}</dd>
                  </>
                )}
              </dl>
              <button
                type="button"
                className="text-button"
                onClick={() => setStep(1)}
              >
                Edit details
              </button>
            </section>
            <fieldset className="plan-section">
              <legend>Choose when to pay</legend>
              <div className="payment-choices">
                {[
                  [
                    "upfront",
                    "Pay online now",
                    "Secure checkout with Razorpay",
                  ],
                  [
                    "after_shoot",
                    "Pay after the shoot",
                    "Book now. Pay online once your shoot ends.",
                  ],
                ].map(([v, a, b]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={payment === v}
                    className={payment === v ? "selected" : ""}
                    onClick={() => setPayment(v)}
                  >
                    <Icon name="card" />
                    <span>
                      <strong>{a}</strong>
                      <small>{b}</small>
                    </span>
                    <span className="radio-dot" />
                  </button>
                ))}
              </div>
            </fieldset>
            <section className="premium-card policy-card">
              <h2>What’s included</h2>
              <p>{RAW_POLICY}</p>
              <label className="check-row">
                <input
                  type="checkbox"
                  required
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I understand the original-file policy.
              </label>
            </section>
          </>
        )}
        {step === 2 && (
          <div className="plan-total">
            <span>
              {service} · {LEVELS[level]} · {duration / 60} hours
            </span>
            <strong>
              {price === null ? "Checking price…" : rupees(price)}
            </strong>
            <small>Original files included · No hidden booking fees</small>
          </div>
        )}
        {(error || priceError) && (
          <p className="error-message" role="alert">
            {error || priceError}{" "}
            {(!services.length || priceError) && (
              <button
                type="button"
                className="text-button"
                onClick={loadOptions}
              >
                Retry
              </button>
            )}
          </p>
        )}
        <button
          className="customer-primary"
          type="submit"
          disabled={busy || price === null}
        >
          {busy
            ? "Creating your booking…"
            : step === 1
              ? "Review booking"
              : payment === "after_shoot"
                ? "Confirm · pay after shoot"
                : "Continue to payment"}
          <Icon name="arrow" />
        </button>
        <p className="secure-note">
          <Icon name="shield" size={17} />
          {step === 1
            ? "No payment at this step."
            : payment === "after_shoot"
              ? "Payment is due after your shoot."
              : "Your booking is confirmed after payment."}
        </p>
      </form>
      {mapOpen && (
        <div
          className="venue-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Choose shoot venue"
          onKeyDown={(e) => {
            if (e.key === "Escape") setMapOpen(false);
          }}
        >
          <div className="venue-dialog">
            <button
              autoFocus
              type="button"
              className="map-close"
              onClick={() => setMapOpen(false)}
            >
              Close map ×
            </button>
            <VenueMap
              initialAddress={address}
              onChoose={(p) => {
                setLat(String(p.lat));
                setLng(String(p.lng));
                setAddress(p.address);
                setMapOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
