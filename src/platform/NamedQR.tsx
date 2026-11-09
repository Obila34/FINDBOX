import { QRCode } from "@/components/ui/qr-code";
import "./houses.css";

/** A FindBox QR that always carries the person's name. The code itself holds no personal data. */
export function NamedQR({ code, name, size = 150, reveal = false }: { code: string; name: string; size?: number; reveal?: boolean }) {
  const url = `${location.origin}/t/${encodeURIComponent(code)}`;
  return (
    <figure className="nq">
      <QRCode value={url} size={size} variant="rounded" errorCorrection="Q" color="#123a2e" reveal={reveal ? "load" : undefined} aria-label={`FindBox QR for ${name}`} />
      <strong>{name}</strong>
      <small>{code}</small>
    </figure>
  );
}
