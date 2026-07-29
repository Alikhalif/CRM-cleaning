"use client";

import { useEffect, useRef } from "react";
import type RingoverSDK from "ringover-sdk";
import {
  RINGOVER_CALL_EVENT,
  emitCallStatus,
  type RingoverCallInfo,
} from "@/lib/ringover-webphone";

// Embeds the Ringover webphone as a floating iframe widget (bottom-right).
// The audio (ringing, answering, talking) happens INSIDE this iframe, so both
// outbound and inbound calls are handled in the CRM. The lead "Appeler" button
// dispatches RINGOVER_CALL_EVENT which we forward to sdk.dial(); the SDK's call
// lifecycle events are re-emitted as status updates for the screen-pop card.
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
      const SDKClass = mod.default ?? (mod as unknown as typeof RingoverSDK);
      if (disposed) return;
      sdk = new SDKClass({
        size: "medium",
        position: { bottom: "16px", right: "16px" },
        animation: true,
      });
      sdk.generate();
      sdkRef.current = sdk;

      // Re-emit the SDK call lifecycle so the screen-pop can reflect it.
      sdk.on("ringingCall", () => emitCallStatus({ state: "ringing" }));
      sdk.on("answeredCall", () => emitCallStatus({ state: "answered" }));
      sdk.on("hangupCall", () => emitCallStatus({ state: "ended" }));
    })();

    const onCall = (e: Event) => {
      const detail = (e as CustomEvent<RingoverCallInfo>).detail;
      const phone = detail?.phone;
      if (!phone || !sdkRef.current) return;
      sdkRef.current.show();
      sdkRef.current.dial(phone);
    };
    window.addEventListener(RINGOVER_CALL_EVENT, onCall);

    return () => {
      disposed = true;
      window.removeEventListener(RINGOVER_CALL_EVENT, onCall);
      try {
        sdk?.destroy();
      } catch {
        /* iframe already gone */
      }
    };
  }, []);

  return null;
}
