import type { SVGProps } from "react";

// Inline icon set. Stroke-based, current-color so they inherit from the surrounding text.
// Add icons here as the UI grows; avoid pulling in an icon library for the scaffold.

export type IconName =
  | "dashboard"
  | "pipeline"
  | "leads"
  | "commerciaux"
  | "planification"
  | "comptabilite"
  | "settings"
  | "search"
  | "bell"
  | "moon"
  | "sun"
  | "chevron-down"
  | "panel-left"
  | "more-vertical"
  | "zap"
  | "alert"
  | "x"
  | "check"
  | "phone";

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3"  y="3"  width="7" height="9"  rx="1.5" />
      <rect x="14" y="3"  width="7" height="5"  rx="1.5" />
      <rect x="14" y="12" width="7" height="9"  rx="1.5" />
      <rect x="3"  y="16" width="7" height="5"  rx="1.5" />
    </>
  ),
  pipeline: (
    <>
      <rect x="3"  y="4" width="5" height="16" rx="1.5" />
      <rect x="9.5"  y="4" width="5" height="11" rx="1.5" />
      <rect x="16" y="4" width="5" height="7"  rx="1.5" />
    </>
  ),
  leads: (
    <>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </>
  ),
  commerciaux: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.5 20c0-2.5 2-4.5 4.5-4.5s2.5 2 2.5 4.5" />
    </>
  ),
  planification: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  comptabilite: (
    <>
      <path d="M4 4h12l4 4v12H4z" />
      <path d="M16 4v4h4M8 12h8M8 16h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  moon: (
    <>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "panel-left": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
  "more-vertical": (
    <>
      <circle cx="12" cy="5"  r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  alert: (
    <>
      <path d="M12 2 1 21h22z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  x: <path d="M6 6l12 12M6 18 18 6" />,
  check: <path d="m4 12 5 5L20 6" />,
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2L7.9 9.4a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9z" />
  ),
};

type Props = {
  name: IconName;
  size?: number;
} & Omit<SVGProps<SVGSVGElement>, "name">;

export default function Icon({ name, size = 18, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
