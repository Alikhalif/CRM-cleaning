// Minimal typings for the untyped `ringover-sdk` UMD package (v1.1.3).
// Embeds the Ringover webphone as an iframe; see https://github.com/ringover/ringover-sdk
declare module "ringover-sdk" {
  export interface RingoverSDKOptions {
    type?: "fixed" | "relative" | "absolute";
    size?: "big" | "medium" | "small" | "auto";
    position?: { top?: string; bottom?: string; left?: string; right?: string };
    animation?: boolean;
    border?: boolean;
    trayicon?: boolean;
    backgroundColor?: string;
  }

  // Events carry a `data` payload (shape depends on the event).
  export type RingoverSDKEvent = { data: Record<string, unknown> };

  export default class RingoverSDK {
    constructor(options?: RingoverSDKOptions);
    generate(): HTMLIFrameElement | false;
    destroy(): boolean;
    checkStatus(expected?: number): boolean;
    show(): boolean;
    hide(): boolean;
    toggle(): boolean;
    isDisplay(): boolean;
    dial(numberE164: string, fromNumberE164?: string): boolean;
    sendSMS(toNumberE164: string, content: string, fromNumberE164?: string): boolean;
    openCallLog(callId: string): boolean;
    logout(): boolean;
    reload(): boolean;
    getCurrentPage(): string | false;
    changePage(pageName: string): boolean;
    on(event: string, cb: (e: RingoverSDKEvent) => void): boolean;
    off(): boolean;
  }
}
