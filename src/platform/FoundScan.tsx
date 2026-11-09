import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Camera, Check, Home, ImagePlus, MapPin, Plus, RotateCcw, ScanLine, X } from "lucide-react";
import { squarePhoto } from "./profile";
import { useScanner } from "@/lib/useScanner";
import { api } from "./api";
import { notify } from "./feedback";
import "./houses.css";

type Box = { id: string; name: string; opening_hours: string };
type Scan = { code: string; mine: boolean; studentId?: string | null; labels?: { delivered: number; used: number; remaining: number } | null; child: string; items: { id: string; name: string; category: string; status: string; open: string | null }[]; boxes: { id: string; name: string; opening_hours: string }[] };

const CATEGORIES: [string, string][] = [["clothing", "Clothing"], ["bottle", "Bottle"], ["lunchbox", "Lunchbox"], ["book", "Book"], ["sports", "Sports kit"], ["electronics", "Gadget"], ["keys", "Keys"], ["other", "Other"]];

/** QR codes hold a link like https://findbox.africa/t/FB-…; people may also type the code itself. */
export const codeFrom = (text: string) => {
  const t = text.trim();
  const m = /\/t\/([^/?#\s]+)/.exec(t);
  return decodeURIComponent(m ? m[1]! : t);
};

/**
 * Scan: one scanner for everything.
 *  - Your child's label: add a belonging to it, or mark something as back with you.
 *  - Someone else's label: their family is told at once; hand it back or drop it at a box.
 *  - "Add a belonging" opens the same scanner with its own wording and goes straight to adding.
 */
export function FoundScan({ staff = false, boxes = [], onDone }: { staff?: boolean; boxes?: Box[]; onDone?: () => void }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [adding, setAdding] = useState(!staff && params.get("mode") === "add");
  const forChild = params.get("child") || "";
  const [added, setAdded] = useState<{ name: string; child: string; left: number } | null>(null);
  const [scan, setScan] = useState<Scan | null>(null), [pick, setPick] = useState(""), [box, setBox] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState<{ mine: boolean; message: string } | null>(null);
  const [untagged, setUntagged] = useState(false), [photo, setPhoto] = useState<string | null>(null);
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
  const reset = () => { setScan(null); setDone(null); setPick(""); setUntagged(false); setPhoto(null); setAdded(null); };
  async function handIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      const r = await api<{ message: string }>(staff ? "/staff/unclaimed" : "/found/untagged", staff
        ? { title: d.title, category: d.category, boxId: d.boxId, privateNote: d.where || "Logged by school staff", photo }
        : { title: d.title, category: d.category, where: d.where || "", boxId: d.boxId || "", photo });
      setDone({ mine: false, message: staff ? "Logged in the unclaimed gallery. Families can now claim it." : r.message }); onDone?.();
    } catch { /* toast shown */ } finally { setBusy(false); }
  }
  async function addBelonging(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!scan?.studentId) return;
    const form = e.currentTarget, d = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(true);
    try {
      await api("/family/children/" + scan.studentId + "/items", { ...d, code: scan.code });
      if (adding) setAdded({ name: d.name!, child: scan.child.split(" ")[0]!, left: Math.max(0, (scan.labels?.remaining ?? 1) - 1) });
      else { notify(`${d.name} is now on ${scan.child.split(" ")[0]}'s QR.`); form.reset(); await open(scan.code); }
      onDone?.();
    } catch { /* toast shown */ } finally { setBusy(false); }
  }

  if (added) return (
    <section className="hs-card fs-done" role="status">
      <span><Check size={30} /></span>
      <h2>{added.name} added</h2>
      <p>It's on {added.child}'s QR now. {added.left} label{added.left === 1 ? "" : "s"} left.</p>
      {added.left > 0 ? <button type="button" className="fp-primary" onClick={reset}><ScanLine size={17} />Scan the next label</button> : <Link className="fp-primary" to="/app/shop">Order more labels</Link>}
    </section>
  );

  // Adding a belonging: after scanning, go straight to naming it.
  if (scan && adding) {
    const left = scan.labels?.remaining ?? 0;
    return (
      <section className="hs-card fs-result">
        {scan.mine && scan.studentId ? <>
          <div className="fs-who"><div><small className="hs-note">Adding to</small><br /><b>{scan.child}</b></div></div>
          {left > 0 ? <form className="fs-add fs-add-main" onSubmit={addBelonging}>
            <label className="fp-field"><span>What is the belonging?</span><input name="name" required maxLength={100} placeholder="e.g. Navy sweater" autoFocus /></label>
            <label className="fp-field"><span>Kind</span><select name="category" defaultValue="clothing">{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <button className="fp-primary" disabled={busy}><Plus size={17} />Add belonging</button>
            <p className="hs-note">{left} label{left === 1 ? "" : "s"} left.</p>
          </form> : <p className="hs-note">{scan.labels?.delivered ? `All ${scan.labels.delivered} labels are in use.` : "Your labels haven't been delivered yet."} <Link to="/app/shop">Order labels</Link> to add more belongings.</p>}
          {scan.items.length > 0 && <div className="fs-have"><small className="hs-note">Already on this QR</small><p>{scan.items.map((i) => i.name).join(" · ")}</p></div>}
        </> : <>
          <div className="fs-who"><div><small className="hs-note">This label belongs to</small><br /><b>{scan.child || "another family"}</b></div></div>
          <p className="hs-note">It isn't one of your children's labels, so you can't add to it. Did you find this item?</p>
          <button type="button" className="fp-primary" onClick={() => setAdding(false)}>I found it</button>
        </>}
        <button type="button" className="fs-link" onClick={reset}><RotateCcw size={14} />Scan a different label</button>
      </section>
    );
  }

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
          {scan.mine && scan.studentId && scan.labels && scan.labels.remaining === 0 && <p className="hs-note fs-add">
            {scan.labels.delivered ? `All ${scan.labels.delivered} labels are in use.` : "Your labels haven't been delivered yet."} <Link to="/app/shop">Order labels</Link> to add more belongings.</p>}
          {scan.mine && scan.studentId && (scan.labels?.remaining ?? 0) > 0 && <form className="fs-add" onSubmit={addBelonging}>
            <p className="hs-note">Labelling something new? Add it to this QR. {scan.labels!.remaining} label{scan.labels!.remaining === 1 ? "" : "s"} left.</p>
            <div><input name="name" required maxLength={100} placeholder="e.g. Navy sweater" aria-label="New belonging" />
              <select name="category" aria-label="Kind of belonging" defaultValue="clothing">{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <button className="fs-ghost" disabled={busy}><Plus size={15} />Add</button></div>
          </form>}
          <button type="button" className="fs-link" onClick={reset}><RotateCcw size={14} />Scan a different code</button>
        </div>
      </section>
    );
  }

  if (untagged) return (
    <form className="hs-card fs-result" onSubmit={handIn}>
      <div className="fs-who"><b>{staff ? "Log an item without a QR" : "No QR on it"}</b></div>
      <p className="hs-note">{staff ? "It goes to your unclaimed gallery for families to claim." : "Describe it so its owner recognises it. The school is told straight away."}</p>
      <label className="fp-field"><span>What is it?</span><input name="title" required minLength={3} maxLength={100} placeholder="e.g. Blue Grade 4 sweater, size 10" /></label>
      <label className="fp-field"><span>Kind</span><select name="category" defaultValue="clothing">{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="fp-field"><span>{staff ? "Private detail for ownership checks" : "Where did you find it? (optional)"}</span><input name="where" maxLength={200} required={staff} placeholder={staff ? "e.g. name written inside the collar" : "e.g. Sports field, after PE"} /></label>
      <div className="fs-photo">
        {photo ? <><img src={photo} alt="Your photo of the item" /><button type="button" className="fs-link" onClick={() => setPhoto(null)}><X size={14} />Remove photo</button></>
          : <label className="fs-ghost"><ImagePlus size={16} />Add a photo<input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setPhoto(await squarePhoto(f, 480)); } catch (err) { notify((err as Error).message, "error"); } }} /></label>}
      </div>
      {boxes.length > 0 && <label className="fp-field"><span>{staff ? "Stored in" : "Hand it in at"}</span><select name="boxId" required={staff} defaultValue={staff ? boxes[0]!.id : ""}>{!staff && <option value="">A teacher or the school office</option>}{boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      <button className="fp-primary" disabled={busy}><Check size={17} />{staff ? "Log item" : "Hand it in"}</button>
      <button type="button" className="fs-link" onClick={reset}><RotateCcw size={14} />Back to scanning</button>
    </form>
  );

  return (
    <div className="fs-result">
      {scanner.state === "scanning" || scanner.state === "requesting"
        ? <div className="fs-camera"><video ref={scanner.videoRef} muted playsInline /></div>
        : <button type="button" className="fs-start" onClick={() => void scanner.start()} disabled={busy}><span><Camera size={32} /></span>{adding ? (forChild ? `Scan ${forChild}'s label` : "Scan the label") : "Scan a FindBox QR"}</button>}
      {scanner.state === "denied" && <p className="hs-note" role="alert">Camera access is off. Allow the camera for FindBox in your phone settings, then tap Scan again.</p>}
      {scanner.state === "unsupported" && <p className="hs-note" role="alert">This device can't scan here. Open FindBox on a phone with a camera.</p>}
      {!adding && <button type="button" className="fs-ghost fs-noqr" onClick={() => { scanner.stop(); setUntagged(true); }}>Found something with no QR?</button>}
    </div>
  );
}
