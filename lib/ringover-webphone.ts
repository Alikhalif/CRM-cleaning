// Client-only bridge between per-page UI (e.g. the lead "Appeler" button) and
// the singleton Ringover webphone widget mounted once in the app layout.
// Uses a window CustomEvent so callers never need a direct SDK reference.

export const RINGOVER_DIAL_EVENT = "cgk:ringover-dial";

export type RingoverDialDetail = { phone: string };

// Ask the embedded webphone to dial a number (E.164, e.g. "+33690337102").
// No-op on the server; the widget listens for this event in the browser.
export function dialViaWebphone(phoneE164: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RingoverDialDetail>(RINGOVER_DIAL_EVENT, { detail: { phone: phoneE164 } }),
  );
}
