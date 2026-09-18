// Client-only bridge between per-page UI (the lead "Appeler" button) and the
// singleton widgets mounted once in the app layout: the Ringover webphone
// (dials + audio) and the call screen-pop (designed status card).
// Uses window CustomEvents so callers never need a direct reference.

export const RINGOVER_CALL_EVENT = "cgk:ringover-call";
export const RINGOVER_STATUS_EVENT = "cgk:ringover-status";
export const RINGOVER_SMS_EVENT = "cgk:ringover-sms";
export const RINGOVER_SMS_RESULT_EVENT = "cgk:ringover-sms-result";
export const RINGOVER_TOGGLE_EVENT = "cgk:ringover-toggle";

// Show/hide the embedded Ringover webphone widget.
export function toggleWebphone(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RINGOVER_TOGGLE_EVENT));
}

export type RingoverSmsDetail = { phone: string; content: string };
export type RingoverSmsResult = { ok: boolean };

// Send an SMS through the embedded Ringover webphone (sdk.sendSMS). Returns a
// promise that resolves TRUE only when the webphone confirms the send, and
// FALSE if the webphone isn't ready or the SDK rejects it — so the caller never
// records a false "SMS envoyé" (A18). Falls back to false after a short timeout
// (webphone widget absent → no result event ever arrives).
export function sendSmsViaWebphone(phoneE164: string, content: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener(RINGOVER_SMS_RESULT_EVENT, onResult as EventListener);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onResult = (e: Event) =>
      finish(!!(e as CustomEvent<RingoverSmsResult>).detail?.ok);
    window.addEventListener(RINGOVER_SMS_RESULT_EVENT, onResult as EventListener);
    const timer = window.setTimeout(() => finish(false), 4000);
    window.dispatchEvent(
      new CustomEvent<RingoverSmsDetail>(RINGOVER_SMS_EVENT, { detail: { phone: phoneE164, content } }),
    );
  });
}

// Emitted by the webphone widget after an SMS attempt so the composer knows
// whether to record it as sent.
export function emitSmsResult(ok: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<RingoverSmsResult>(RINGOVER_SMS_RESULT_EVENT, { detail: { ok } }));
}

// Rich payload for a call the CRM initiates — drives BOTH the webphone dial
// and the screen-pop card.
export type RingoverCallInfo = {
  phone: string; // E.164, e.g. "+33690337102"
  name: string;
  sublabel?: string; // e.g. "Nettoyage · Nettoyage de façade"
  sectorVar?: string; // CSS custom-property name for the accent, e.g. "--sector-nettoyage"
  initials?: string;
  leadId?: string; // to link "Ouvrir la fiche"
};

export type RingoverCallState = "dialing" | "ringing" | "answered" | "ended";
export type RingoverStatus = { state: RingoverCallState };

// Start a call: the webphone dials it and the screen-pop shows the card.
export function startCall(info: RingoverCallInfo): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<RingoverCallInfo>(RINGOVER_CALL_EVENT, { detail: info }));
}

// Emitted by the webphone as the SDK reports call progress; consumed by the
// screen-pop to update its status + auto-dismiss.
export function emitCallStatus(status: RingoverStatus): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<RingoverStatus>(RINGOVER_STATUS_EVENT, { detail: status }));
}
