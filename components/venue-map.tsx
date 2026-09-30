"use client";
import { useEffect, useRef, useState } from "react";
type Point = { lat: number; lng: number };
type MapInstance = {
  on: (event: string, handler: (event: { latlng: Point }) => void) => void;
  remove: () => void;
  getCenter: () => Point;
  setView: (point: [number, number], zoom: number) => MapInstance;
};
type Pin = {
  addTo: (map: MapInstance) => Pin;
  setLatLng: (point: Point) => Pin;
};
type Leaflet = {
  map: (element: HTMLElement) => MapInstance;
  tileLayer: (
    url: string,
    options: Record<string, unknown>,
  ) => { addTo: (map: MapInstance) => void };
  circleMarker: (
    point: [number, number],
    options: Record<string, unknown>,
  ) => Pin;
  circle: (
    point: [number, number],
    options: Record<string, unknown>,
  ) => { addTo: (map: MapInstance) => void };
};
declare global {
  interface Window {
    L?: Leaflet;
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}
const STUDIO: [number, number] = [23.184690686312052, 77.43527393974985];
let leafletReady: Promise<void> | undefined;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (!leafletReady)
    leafletReady = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/vendor/leaflet/leaflet.js";
      script.onload = () => resolve();
      script.onerror = () => {
        leafletReady = undefined;
        script.remove();
        reject(new Error("Map could not load. Please retry."));
      };
      document.head.appendChild(script);
    });
  return leafletReady;
}
export default function VenueMap({
  onChoose,
  initialAddress = "",
}: {
  onChoose: (point: Point & { address: string }) => void;
  initialAddress?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const pinRef = useRef<Pin | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [address, setAddress] = useState(initialAddress);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadLeaflet()
      .then(() => {
        if (!active || !element.current || !window.L) return;
        const L = window.L;
        const map = L.map(element.current).setView(STUDIO, 13);
        mapRef.current = map;
        L.tileLayer(
          process.env.NEXT_PUBLIC_MAP_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          },
        ).addTo(map);
        L.circle(STUDIO, {
          radius: 15000,
          color: "#24503c",
          fillOpacity: 0.035,
          weight: 1,
        }).addTo(map);
        map.on("click", ({ latlng }) => {
          if (!pinRef.current)
            pinRef.current = L.circleMarker([latlng.lat, latlng.lng], {
              radius: 10,
              color: "#fff",
              weight: 3,
              fillColor: "#24503c",
              fillOpacity: 1,
            }).addTo(map);
          else pinRef.current.setLatLng(latlng);
          setPoint({ lat: latlng.lat, lng: latlng.lng });
        });
        setError("");
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
  }, [attempt]);
  function selectCenter() {
    const center = mapRef.current?.getCenter();
    if (!center || !window.L || !mapRef.current) return;
    if (!pinRef.current)
      pinRef.current = window.L.circleMarker([center.lat, center.lng], {
        radius: 10,
        color: "#fff",
        weight: 3,
        fillColor: "#24503c",
        fillOpacity: 1,
      }).addTo(mapRef.current);
    else pinRef.current.setLatLng(center);
    setPoint({ lat: center.lat, lng: center.lng });
  }
  return (
    <div className="venue-picker">
      <link rel="stylesheet" href="/vendor/leaflet/leaflet.css" />
      <h2>Choose your shoot location</h2>
      <p>
        Tap your venue on the map, or move the map and select its centre. We
        serve locations within 15 km of Rohit Nagar, Bhopal.
      </p>
      <div ref={element} className="venue-map" aria-label="Bhopal venue map" />
      {error && (
        <div className="notice error" role="alert">
          {error}{" "}
          <button type="button" onClick={() => setAttempt((v) => v + 1)}>
            Retry map
          </button>
        </div>
      )}
      <button className="btn secondary" type="button" onClick={selectCenter}>
        Select map centre
      </button>
      <label className="field">
        Venue address and landmark
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={300}
          placeholder="Venue, street and landmark"
        />
      </label>
      <p className="map-pin-status" aria-live="polite">
        {point ? "Location pin selected" : "Choose a pin to continue"}
      </p>
      <button
        type="button"
        className="btn"
        disabled={!point || address.trim().length < 3}
        onClick={() => {
          if (point) onChoose({ ...point, address: address.trim() });
        }}
      >
        Use this location
      </button>
    </div>
  );
}
