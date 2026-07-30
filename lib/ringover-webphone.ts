// Client-only bridge between per-page UI (the lead "Appeler" button) and the
// singleton widgets mounted once in the app layout: the Ringover webphone
// (dials + audio) and the call screen-pop (designed status card).
// Uses window CustomEvents so callers never need a direct reference.

export const RINGOVER_CALL_EVENT = "cgk:ringover-call";
export const RINGOVER_STATUS_EVENT = "cgk:ringover-status";
export const RINGOVER_SMS_EVENT = "cgk:ringover-sms";
export const RINGOVER_TOGGLE_EVENT = "cgk:ringover-toggle";

// Show/hide the embedded Ringover webphone widget.
export function toggleWebphone(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RINGOVER_TOGGLE_EVENT));
}

export type RingoverSmsDetail = { phone: string; content: string };

// Send an SMS through the embedded Ringover webphone (sdk.sendSMS).
export function sendSmsViaWebphone(phoneE164: string, content: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RingoverSmsDetail>(RINGOVER_SMS_EVENT, { detail: { phone: phoneE164, content } }),
  );
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
