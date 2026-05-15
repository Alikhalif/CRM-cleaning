"use client";

import { useEffect, useState } from "react";
import { relativeFromNow } from "@/lib/leads";

// Relative-time text refreshes every minute. The useState lazy initializer
// runs on both server and client; client init produces a slightly later "now"
// than the SSR pass, so suppressHydrationWarning lets React commit the
// client's value without warning. After mount, an interval keeps it fresh.

type Props = { iso: string; className?: string };

export default function RelativeTime({ iso, className }: Props) {
  const [text, setText] = useState(() => relativeFromNow(iso));

  useEffect(() => {
    const tick = () => setText(relativeFromNow(iso));
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [iso]);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
