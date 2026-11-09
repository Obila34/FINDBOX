import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, Clock, House, MapPin, Package, PackageCheck, QrCode, ScanLine, School, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Flame, MapPinned } from "lucide-react";
import { api, type User, type Workspace } from "./api";
import { HouseDot, type HouseId } from "./Houses";
import { imagery } from "@/data/imagery";
import { ItemCard, PromoCarousel, SectionHead, Shortcuts, type Slide } from "./AppKit";

const itemPicture = (category: string) => (imagery.catalog[category as keyof typeof imagery.catalog] ?? imagery.catalog.book).src;
type HouseInfo = { standings: { house: HouseId; name: string; rank: number }[]; members: { house: HouseId | null }[] };

/** The family and student home, kept calm: one highlight, four shortcuts, a few belongings. */
function FamilyHome({ user, workspace }: { user: User; workspace: Workspace }) {
  const [houses, setHouses] = useState<HouseInfo | null>(null);
  useEffect(() => { if (workspace.school) api<HouseInfo>("/houses").then(setHouses).catch(() => {}); }, [workspace.school]);
  const student = user.role === "student";
  const waiting = workspace.cases.filter((c) => c.status === "awaiting_collection");
  const statusOf = (i: Workspace["items"][number]) => waiting.some((c) => c.item_id === i.id) ? "awaiting_collection" : i.status;
  const items = workspace.items.map((i) => ({ ...i, shown: statusOf(i) }));
  const hour = new Date().getHours(), hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const myHouse = houses?.members.find((m) => m.house)?.house;
  const rank = myHouse ? houses?.standings.find((s) => s.house === myHouse)?.rank : undefined;
  const slides = useMemo<Slide[]>(() => waiting.length
    ? [{ kicker: waiting.length + (waiting.length === 1 ? " item is" : " items are") + " waiting", title: "Ready to", accent: "collect.", body: `At ${waiting[0]!.box_name}. Bring your FindBox confirmation.`, cta: "View", to: "/app/cases", image: imagery.features.collect.src, tone: "pop" as const }]
    : [{ kicker: "Less waste", title: "Found, not", accent: "replaced.", body: "Every return is one less uniform, bottle or book bought again.", cta: student ? "See houses" : "Label more", to: student ? "/app/houses" : "/app/children", image: imagery.hero[2]!.src, tone: "night" as const }], [waiting.length, student]);
  return (
    <div className="pa-home">
      <div className="pa-home-top">
        <div>
          <p className="pa-hello">{hello},</p>
          <h1 className="pa-name">{user.name.split(" ")[0]}</h1>
        </div>
        {myHouse && <Link to="/app/houses" className="pa-house-chip"><HouseDot house={myHouse} size={10} />{myHouse[0]!.toUpperCase() + myHouse.slice(1)}{rank ? ` · #${rank}` : ""}</Link>}
      </div>
      <PromoCarousel slides={slides} />
      <Shortcuts items={student ? [
        { label: "I found it", to: "/app/found", Icon: ScanLine },
        { label: "Houses", to: "/app/houses", Icon: Trophy },
        { label: "Streaks", to: "/app/streaks", Icon: Flame },
        { label: "Collect", to: "/app/cases", Icon: MapPinned, badge: waiting.length },
      ] : [
        { label: "I found it", to: "/app/found", Icon: ScanLine },
        { label: "Children & QR", to: "/app/children", Icon: QrCode },
        { label: "Houses", to: "/app/houses", Icon: Trophy },
        { label: "Collect", to: "/app/cases", Icon: MapPinned, badge: waiting.length },
      ]} />
      <section className="pa-home">
        <SectionHead title={student ? "My belongings" : "Belongings"} to="/app/items" />
        {items.length ? <div className="pa-grid">{items.slice(0, 4).map((i, n) => <ItemCard key={i.id} index={n} name={i.name} image={itemPicture(i.category)} status={i.shown} owner={i.child_name || undefined} code={i.code} to="/app/items" />)}</div>
          : <p className="pa-empty">No belongings yet. {student ? "Ask your parent to add them under your QR." : <Link to="/app/children">Add your child's first belonging</Link>}</p>}
      </section>
    </div>
  );
}

/** Home for parents, students and teachers: greeting, live counts, quick actions and first steps. */
export function HomeDashboard({ user, workspace, staff }: { user: User; workspace: Workspace; staff: boolean }) {
                  if (!staff) return <FamilyHome user={user} workspace={workspace} />;
                  const waiting = workspace.cases.filter((c) => c.status === "awaiting_collection");
                  const overdue = waiting.filter((c) => c.due_at && Date.parse(c.due_at) < Date.now());
                  const incoming = workspace.cases.filter((c) => ["awaiting_deposit", "reported_lost"].includes(c.status));
                  const open = workspace.cases.filter((c) => !["returned", "closed"].includes(c.status));
                  const hour = new Date().getHours(), hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
                  const steps = staff ? [] : [
                    { done: user.verified, label: "Verify your email", hint: "Check your inbox for our link.", to: "" },
                    { done: !!workspace.school, label: "Join your school", hint: "Use your school's link or poster.", to: "/app/security" },
                    { done: user.role === "student" || workspace.children.length > 0, label: "Add your child", hint: "Your school approves it.", to: "/app/children" },
                    { done: workspace.orders.length > 0 || workspace.items.length > 0, label: "Get a tag pack", hint: "Stickers, labels and tags.", to: "/app/shop" },
                    { done: workspace.items.length > 0, label: "Activate your tags", hint: "One code activates the whole pack.", to: "/app/register" },
                  ];
                  const left = steps.filter((x) => !x.done).length;
                  const kpi = (to: string, tone: string, Icon: typeof House, label: string, value: number, hint: string) => (
                    <Link to={to} className={"db-kpi tone-" + tone}><div className="db-kpi-top"><span className="db-kpi-icon"><Icon size={18} /></span><span className="db-kpi-label">{label}</span></div><strong>{value}</strong><div className="db-kpi-foot"><small>{hint}</small></div></Link>
                  );
                  return (
                    <div className="db-vars fp-dash">
                      <section className="db-hero fp-hero2">
                        <div className="db-hero-art" aria-hidden="true"><i /><i /><i /></div>
                        <div className="db-hero-main">
                          <span className={"db-status is-" + ((staff ? overdue.length : waiting.length) ? "warning" : "good")}><i />
                            {staff
                              ? overdue.length ? `${overdue.length} past the collection date` : waiting.length ? `${waiting.length} waiting for families` : "All clear today"
                              : waiting.length ? `${waiting.length} ${waiting.length === 1 ? "item is" : "items are"} waiting for you` : "Nothing lost right now"}
                          </span>
                          <h1>{hello}, {user.name.split(" ")[0]}.</h1>
                          <p>{staff ? "Receive found items, then hand them back to their families." : "Your belongings, tags and school, all in one place."}</p>
                          <div className="db-quick">
                            {staff ? <>
                              <Link to="/manage/log"><ScanLine size={17} />Receive an item</Link>
                              <Link to="/manage/collect"><PackageCheck size={17} />Hand back</Link>
                              {user.role === "manager" && <Link to="/app/school-admin"><School size={17} />School workspace</Link>}
                              <Link to="/app/houses"><Trophy size={17} />Houses</Link>
                            </> : <>
                              <Link to="/app/found"><PackageCheck size={17} />I found it</Link>
                            </>}
                          </div>
                        </div>
                      </section>
                      <div className="db-kpis">
                        {staff ? <>
                          {kpi("/manage/collect", "amber", Clock, "Waiting for families", waiting.length, "Ready to hand back")}
                          {kpi("/manage/collect", "coral", AlertTriangle, "Past collection date", overdue.length, "Remind or extend")}
                          {kpi("/manage", "sky", ScanLine, "To receive", incoming.length, "Reported or on the way")}
                          {kpi("/app/boxes", "mint", MapPin, "Collection boxes", workspace.boxes.length, "Where items wait")}
                        </> : <>
                          {kpi("/app/items", "mint", Package, "Belongings", workspace.items.length, "Protected by a tag")}
                          {kpi("/app/cases", "amber", Clock, "Waiting for you", waiting.length, "Ready to collect")}
                          {kpi("/app/cases", "sky", AlertTriangle, "Open recoveries", open.length, "Being looked for")}
                          {kpi("/app/boxes", "lilac", MapPin, "Collection boxes", workspace.boxes.length, "At your school")}
                        </>}
                      </div>
                      {left > 0 && (
                        <section className="db-card fp-steps">
                          <header><h3><CheckCircle2 size={18} />Getting started</h3><span className="fp-steps-count">{steps.length - left} of {steps.length} done</span></header>
                          <div className="fp-steps-bar"><span style={{ width: `${((steps.length - left) / steps.length) * 100}%` }} /></div>
                          <ol>{steps.map((x, i) => (
                            <li key={x.label} className={x.done ? "is-done" : ""}>
                              <span className="sa-step">{x.done ? <Check size={15} /> : i + 1}</span>
                              <div><strong>{x.label}</strong><small>{x.hint}</small></div>
                              {!x.done && x.to && <Link to={x.to}>Start <ArrowUpRight size={14} /></Link>}
                            </li>
                          ))}</ol>
                        </section>
                      )}
                    </div>
                  );
}
