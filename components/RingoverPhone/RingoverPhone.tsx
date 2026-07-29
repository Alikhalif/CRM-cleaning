"use client";

import { useEffect, useRef } from "react";
import type RingoverSDK from "ringover-sdk";
import { RINGOVER_DIAL_EVENT, type RingoverDialDetail } from "@/lib/ringover-webphone";

// Embeds the Ringover webphone as a floating iframe widget (bottom-right).
// The audio (ringing, answering, talking) happens INSIDE this iframe, so both
// outbound and inbound calls are handled in the CRM. The lead "Appeler" button
// dispatches a RINGOVER_DIAL_EVENT that we forward to the SDK's dial().
//
// Auth: each commercial logs into Ringover once inside the widget (their own
// seat). The SDK is loaded lazily in the browser only — it touches window/DOM
// and must never run during SSR.

export default function RingoverPhone() {
  const sdkRef = useRef<RingoverSDK | null>(null);

  useEffect(() => {
    let disposed = false;
    let sdk: RingoverSDK | null = null;

    (async () => {
      const mod = await import("ringover-sdk");
      // UMD default export is the class itself.
      const SDKClass = (mod.default ?? (mod as unknown as typeof RingoverSDK));
      if (disposed) return;
      sdk = new SDKClass({
        size: "medium",
        position: { bottom: "16px", right: "16px" },
        animation: true,
      });
      sdk.generate();
      sdkRef.current = sdk;

      // Call events are logged inside the widget; screen-pop + per-lead
      // history writing are a follow-up (listen to ringingCall/answeredCall).
    })();

    const onDial = (e: Event) => {
      const detail = (e as CustomEvent<RingoverDialDetail>).detail;
      const phone = detail?.phone;
      if (!phone || !sdkRef.current) return;
      sdkRef.current.show();
      sdkRef.current.dial(phone);
    };
    window.addEventListener(RINGOVER_DIAL_EVENT, onDial);

    return () => {
      disposed = true;
      window.removeEventListener(RINGOVER_DIAL_EVENT, onDial);
      try {
        sdk?.destroy();
      } catch {
        /* iframe already gone */
      }
    };
  }, []);

  return null;
}
