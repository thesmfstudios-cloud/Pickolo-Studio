"use client";
import VenueMap from "@/components/venue-map";
import "../customer/customer.css";
export default function ChooseLocation() {
  return (
    <main className="customer-app map-page">
      <VenueMap
        onChoose={(point) => {
          if (window.ReactNativeWebView)
            window.ReactNativeWebView.postMessage(JSON.stringify(point));
        }}
      />
    </main>
  );
}
