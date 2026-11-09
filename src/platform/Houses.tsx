import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, Star, Trophy } from "lucide-react";
import { api } from "./api";
import { notify } from "./feedback";
import "./houses.css";

export type HouseId = "green" | "red" | "blue" | "yellow";
export const HOUSES: { id: HouseId; name: string }[] = [
  { id: "green", name: "Green" },
  { id: "red", name: "Red" },
  { id: "blue", name: "Blue" },
  { id: "yellow", name: "Yellow" },
];
type Standing = { house: HouseId; name: string; members: number; returns: number; cleanWeeks: number; lost: number; stars: number; score: number; rank: number };
type Member = { id: string; name: string; class_name: string; house: HouseId | null };
type Data = { standings: Standing[]; members: Member[]; staff: boolean; canChoose: boolean; myStars: number; windowDays: number };

/** A coloured dot for a house; "none" when unassigned. */
export function HouseDot({ house, size = 12 }: { house: HouseId | null | undefined; size?: number }) {
  return <i className={"hs-dot is-" + (house || "none")} style={{ width: size, height: size }} aria-hidden="true" />;
}

/** Four colour buttons to choose a house. */
export function HousePicker({ value, onPick, disabled, name }: { value: HouseId | null | undefined; onPick: (h: HouseId) => void; disabled?: boolean; name: string }) {
  return (
    <div className="hs-picker" role="radiogroup" aria-label={name}>
      {HOUSES.map((h) => (
        <button key={h.id} type="button" role="radio" aria-checked={value === h.id} disabled={disabled} className={"hs-pick is-" + h.id + (value === h.id ? " is-on" : "")} onClick={() => onPick(h.id)}>
          <HouseDot house={h.id} size={14} />{h.name}
        </button>
      ))}
    </div>
  );
}

/** House standings, the signed-in person's house, and (for school staff) who belongs to which house. */
export function Houses() {
  const [data, setData] = useState<Data | null>(null), [busy, setBusy] = useState(false), [q, setQ] = useState("");
  const load = () => api<Data>("/houses").then(setData).catch((e) => notify((e as Error).message, "error"));
  useEffect(() => { void load(); }, []);
  const members = useMemo(() => (data?.members || []).filter((m) => !q || (m.name + " " + m.class_name).toLowerCase().includes(q.toLowerCase())), [data, q]);
  if (!data) return <p role="status">Loading houses…</p>;
  const leader = data.standings[0];
  const mine = !data.staff ? data.members.find((m) => m.house)?.house : null;
  async function choose(h: HouseId) {
    setBusy(true);
    try { await api("/account/house", { house: h }); notify(`Welcome to ${h[0]!.toUpperCase() + h.slice(1)} house.`); await load(); } catch { /* toast shown */ } finally { setBusy(false); }
  }
  async function assign(m: Member, h: string) {
    setBusy(true);
    try { await api("/school/houses/" + m.id, { house: h || null }); await load(); } catch { /* toast shown */ } finally { setBusy(false); }
  }
  return (
    <div className="hs-page">
      <header className="hs-head">
        <h1>Houses</h1>
        <p>Return what others lose, keep track of your own, and your house climbs.</p>
      </header>

      {data.canChoose && (
        <section className="hs-card hs-choose">
          <h2>Pick your house</h2>
          <p>You choose once. After that, your parent or school can change it.</p>
          <HousePicker value={null} onPick={(h) => void choose(h)} disabled={busy} name="Your house" />
        </section>
      )}

      {leader && leader.score > 0 && (
        <motion.section className={"hs-leader is-" + leader.house} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Trophy size={22} />
          <div><small>Leading this term</small><strong>{leader.name} house</strong></div>
          {mine && <span className="hs-mine"><HouseDot house={mine} />You're in {mine[0]!.toUpperCase() + mine.slice(1)}{data.myStars ? ` · ${data.myStars} star${data.myStars === 1 ? "" : "s"} earned` : ""}</span>}
        </motion.section>
      )}

      <section className="hs-card">
        <h2>Standings</h2>
        <div className="hs-table-wrap">
          <table className="hs-table">
            <thead><tr><th scope="col">#</th><th scope="col">House</th><th scope="col" className="hs-wide">Members</th><th scope="col"><Star size={13} /> Stars</th><th scope="col">Lost</th><th scope="col">Score</th></tr></thead>
            <tbody>
              {data.standings.map((s) => (
                <tr key={s.house} className={mine === s.house ? "is-mine" : ""}>
                  <td>{s.rank}</td>
                  <th scope="row"><HouseDot house={s.house} />{s.name}</th>
                  <td className="hs-wide">{s.members}</td>
                  <td>{s.stars}</td>
                  <td>{s.lost}</td>
                  <td><strong>{s.score}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hs-note">Last {data.windowDays} days. Returning someone else's item earns 3 stars. Every week a member loses nothing earns 1 star, and each lost item takes off 2. The score is per member, so a smaller house can still win.</p>
      </section>

      {(data.staff || data.members.length > 0) && (
        <section className="hs-card">
          <div className="hs-row-head">
            <h2>{data.staff ? "Who belongs where" : "Your family"}</h2>
            {data.staff && <label className="hs-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students" aria-label="Search students" /></label>}
          </div>
          <div className="hs-table-wrap">
            <table className="hs-table is-members">
              <thead><tr><th scope="col">Name</th><th scope="col">Class</th><th scope="col">House</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <th scope="row">{m.name}</th>
                    <td>{m.class_name || "—"}</td>
                    <td>
                      {data.staff
                        ? <select aria-label={"House for " + m.name} value={m.house || ""} disabled={busy} onChange={(e) => void assign(m, e.target.value)}>
                            <option value="">No house</option>
                            {HOUSES.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                          </select>
                        : <span className="hs-tag"><HouseDot house={m.house} />{m.house ? m.house[0]!.toUpperCase() + m.house.slice(1) : "Not chosen yet"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
