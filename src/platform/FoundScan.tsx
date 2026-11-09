import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Camera, Check, Home, MapPin, RotateCcw, ScanLine } from "lucide-react";
import { useScanner } from "@/lib/useScanner";
import { api } from "./api";
import { notify } from "./feedback";
import "./houses.css";

type Scan = { code: string; mine: boolean; child: string; items: { id: string; name: string; category: string; status: string; open: string | null }[]; boxes: { id: string; name: string; opening_hours: string }[] };

/** QR codes hold a link like https://findbox.africa/t/FB-…; people may also type the code itself. */
export const codeFrom = (text: string) => {
  const t = text.trim();
  const m = /\/t\/([^/?#\s]+)/.exec(t);
  return decodeURIComponent(m ? m[1]! : t);
};

/**
 * "I found it": scan a FindBox QR and it links straight to its owner.
 *  - Your own item (or one you reported by mistake) goes back to "with you".
 *  - Someone else's: their family is told at once; hand it back or drop it at a box.
 */
export function FoundScan({ staff = false, onDone }: { staff?: boolean; onDone?: () => void }) {
  const location = useLocation();
  const [scan, setScan] = useState<Scan | null>(null), [pick, setPick] = useState(""), [box, setBox] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState<{ mine: boolean; message: string } | null>(null);
  const scanner = useScanner((text) => { scanner.stop(); void open(codeFrom(text)); });
  async function open(code: string) {
    if (!code) return;
    setBusy(true);
    try {
      const r = await api<Scan>("/scan/" + encodeURIComponent(code));
      setScan(r); setPick(r.items.length === 1 ? r.items[0]!.id : ""); setBox(staff ? r.boxes[0]?.id || "" : ""); setDone(null);
    } catch { /* toast shown */ } finally { setBusy(false); }
  }
  useEffect(() => { const c = new URLSearchParams(location.search).get("code"); if (c) void open(codeFrom(c)); }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(withBox: string) {
    if (!scan) return;
    if (!pick) { notify("Choose which belonging you have.", "error"); return; }
    setBusy(true);
    try {
      const r = await api<{ mine: boolean; message: string }>("/found", { code: scan.code, itemId: pick, boxId: withBox });
      setDone(r); onDone?.();
    } catch { /* toast shown */ } finally { setBusy(false); }
  }
  const reset = () => { setScan(null); setDone(null); setPick(""); };
  function manual(e: FormEvent<HTMLFormElement>) { e.preventDefault(); void open(codeFrom(String(new FormData(e.currentTarget).get("code") || ""))); }

  if (done) return (
    <section className="hs-card fs-done" role="status">
      <span><Check size={30} /></span>
      <h2>{done.mine ? "Welcome home" : "Thank you"}</h2>
      <p>{done.message}</p>
      <button type="button" className="fp-primary" onClick={reset}><ScanLine size={17} />Scan another</button>
    </section>
  );

  if (scan) {
    const chosen = scan.items.find((i) => i.id === pick);
    return (
      <section className="hs-card fs-result">
        <div className="fs-who"><div><small className="hs-note">{scan.mine ? "This is yours" : "This belongs to"}</small><br /><b>{scan.child || "A FindBox family"}</b></div></div>
        {scan.items.length > 1 && <p className="hs-note">Which one do you have?</p>}
        <div className="fs-items" role="radiogroup" aria-label="Belongings">
          {scan.items.map((i) => (
            <button key={i.id} type="button" role="radio" aria-checked={pick === i.id} className={"fs-item" + (pick === i.id ? " is-on" : "")} onClick={() => setPick(i.id)}>
              <span>{i.name}</span>{i.open && <small>{i.open === "awaiting_collection" ? "At the box" : "Being returned"}</small>}
            </button>
          ))}
          {!scan.mine && <button type="button" role="radio" aria-checked={pick === "other"} className={"fs-item" + (pick === "other" ? " is-on" : "")} onClick={() => setPick("other")}><span>Something else of theirs</span></button>}
        </div>
        <div className="fs-actions">
          {scan.mine ? (
            <button type="button" className="fp-primary" disabled={busy || !pick} onClick={() => void submit("")}><Home size={17} />{chosen?.open ? "It's back with us" : "Mark as with us"}</button>
          ) : staff ? (
            <>
              <label className="fp-field"><span>Stored in</span><select value={box} onChange={(e) => setBox(e.target.value)}>{scan.boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              <button type="button" className="fp-primary" disabled={busy || !pick || !box} onClick={() => void submit(box)}>Log drop-off</button>
            </>
          ) : (
            <>
              <button type="button" className="fp-primary" disabled={busy || !pick} onClick={() => void submit("")}><Check size={17} />I'll hand it back</button>
              {scan.boxes.length > 0 && <label className="fp-field"><span>Or drop it at</span>
                <select value={box} onChange={(e) => setBox(e.target.value)}><option value="">Choose a collection box</option>{scan.boxes.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.opening_hours}</option>)}</select></label>}
              {box && <button type="button" className="fs-ghost" disabled={busy || !pick} onClick={() => void submit(box)}><MapPin size={16} />Drop at the box</button>}
            </>
          )}
          <button type="button" className="fs-link" onClick={reset}><RotateCcw size={14} />Scan a different code</button>
        </div>
      </section>
    );
  }

  return (
    <div className="fs-result">
      {scanner.state === "scanning" || scanner.state === "requesting"
        ? <div className="fs-camera"><video ref={scanner.videoRef} muted playsInline /></div>
        : <button type="button" className="fs-start" onClick={() => void scanner.start()} disabled={busy}><span><Camera size={32} /></span>Scan a FindBox QR</button>}
      {scanner.state === "denied" && <p className="hs-note" role="alert">Camera access is off. Type the code under the QR instead.</p>}
      {scanner.state === "unsupported" && <p className="hs-note" role="alert">This device can't scan here. Type the code under the QR instead.</p>}
      <form className="fs-manual" onSubmit={manual}>
        <input name="code" aria-label="Code under the QR" placeholder="Or type the code, e.g. FB-…" autoComplete="off" />
        <button className="fp-primary" disabled={busy}>Open</button>
      </form>
      {!staff && <p className="hs-note" style={{ textAlign: "center" }}>No QR on it? Hand it to your school's <Link to="/app/boxes">collection box</Link>.</p>}
    </div>
  );
}
