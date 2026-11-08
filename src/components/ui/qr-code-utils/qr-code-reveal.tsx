import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Reveals QR modules from the centre outwards with a growing circular mask, on first paint ("load")
 * or once the code scrolls into view ("in-view"). With reduced motion, or when printing, the code simply shows.
 */
export function QRCodeReveal({ total, trigger, duration, children }: { total: number; trigger: "load" | "in-view"; duration: number; children: ReactNode }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<SVGGElement>(null);
  const [go, setGo] = useState(trigger === "load");
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (trigger !== "in-view" || still) return;
    const el = ref.current?.ownerSVGElement;
    if (!el || typeof IntersectionObserver === "undefined") { setGo(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setGo(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [trigger, still]);
  if (still) return <>{children}</>;
  const radius = total * 0.75;
  return (
    <g ref={ref}>
      <defs>
        <mask id={`qr-reveal-${id}`} maskUnits="userSpaceOnUse">
          <circle cx={total / 2} cy={total / 2} r={radius} fill="#fff"
            style={{ transformOrigin: "50% 50%", transformBox: "fill-box", transform: go ? "scale(1)" : "scale(0)", animation: go ? `qr-code-reveal ${duration}ms cubic-bezier(.16,1,.3,1) both` : undefined }} />
        </mask>
      </defs>
      <g mask={`url(#qr-reveal-${id})`}>{children}</g>
    </g>
  );
}
