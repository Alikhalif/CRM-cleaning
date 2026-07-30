"use client";

import { useEffect, useRef } from "react";
import type RingoverSDK from "ringover-sdk";
import {
  RINGOVER_CALL_EVENT,
  RINGOVER_SMS_EVENT,
  RINGOVER_TOGGLE_EVENT,
  emitCallStatus,
  type RingoverCallInfo,
  type RingoverSmsDetail,
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
      try {
        const mod = await import("ringover-sdk");
        const SDKClass = mod.default ?? (mod as unknown as typeof RingoverSDK);
        if (disposed) return;
        sdk = new SDKClass({
          size: "medium",
          position: { bottom: "16px", right: "16px" },
          animation: true,
        });
        const iframe = sdk.generate();
        sdkRef.current = sdk;

        // WebRTC calling needs the iframe to be granted microphone (and
        // autoplay for the ring/audio). Without this Permissions-Policy the
        // widget shows "Vous n'avez pas autorisé l'accès à votre microphone"
        // even when the browser permission is granted.
        const el =
          iframe instanceof HTMLIFrameElement
            ? iframe
            : document.querySelector<HTMLIFrameElement>("iframe[src*='ringover']");
        if (el) el.setAttribute("allow", "microphone; autoplay; camera; speaker-selection");

        // Re-emit the SDK call lifecycle so the screen-pop can reflect it.
        sdk.on("ringingCall", () => emitCallStatus({ state: "ringing" }));
        sdk.on("answeredCall", () => emitCallStatus({ state: "answered" }));
        sdk.on("hangupCall", () => emitCallStatus({ state: "ended" }));
      } catch (err) {
        console.error("[ringover] échec du chargement du webphone SDK", err);
      }
    })();

    // Feedback explicite quand le webphone n'est pas prêt (widget non monté ou
    // agent non connecté à Ringover), sinon les échecs sont silencieux.
    const notReady = () =>
      window.alert(
        "Le webphone Ringover n'est pas prêt.\n\n" +
          "1. Vérifie que le widget téléphone est visible en bas à droite.\n" +
          "2. Ouvre-le et connecte-toi à ton compte Ringover.\n" +
          "3. Réessaie.\n\n" +
          "(Si le widget n'apparaît pas du tout : redémarre le serveur — Ctrl+C puis npm run dev.)",
      );

    const onCall = (e: Event) => {
      const detail = (e as CustomEvent<RingoverCallInfo>).detail;
      const phone = detail?.phone;
      if (!phone) return;
      if (!sdkRef.current) {
        notReady();
        return;
      }
      sdkRef.current.show();
      const ok = sdkRef.current.dial(phone);
      if (ok === false) notReady();
    };
    const onSms = (e: Event) => {
      const detail = (e as CustomEvent<RingoverSmsDetail>).detail;
      if (!detail?.phone || !detail.content) return;
      if (!sdkRef.current) {
        notReady();
        return;
      }
      sdkRef.current.show();
      const ok = sdkRef.current.sendSMS(detail.phone, detail.content);
      if (ok === false) notReady();
    };
    const onToggle = () => {
      const sdk = sdkRef.current;
      if (!sdk) {
        notReady();
        return;
      }
      // Bascule native du SDK Ringover.
      sdk.toggle();
    };
    window.addEventListener(RINGOVER_CALL_EVENT, onCall);
    window.addEventListener(RINGOVER_SMS_EVENT, onSms);
    window.addEventListener(RINGOVER_TOGGLE_EVENT, onToggle);

    return () => {
      disposed = true;
      window.removeEventListener(RINGOVER_CALL_EVENT, onCall);
      window.removeEventListener(RINGOVER_SMS_EVENT, onSms);
      window.removeEventListener(RINGOVER_TOGGLE_EVENT, onToggle);
      try {
        sdk?.destroy();
      } catch {
        /* iframe already gone */
      }
    };
  }, []);

  return null;
}
