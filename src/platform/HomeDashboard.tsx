import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, Clock, House, MapPin, Package, PackageCheck, ScanLine, School } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, MapPinned, Search, ShoppingBag, Sparkles, Users } from "lucide-react";
import { api, type Product, type User, type Workspace } from "./api";
import { imagery } from "@/data/imagery";
import { catalog } from "@/commerce/store";
import { Chips, ItemCard, ProductCard, PromoCarousel, SectionHead, Shortcuts, StatStrip, type Slide } from "./AppKit";

const itemPicture = (category: string) => (imagery.catalog[category as keyof typeof imagery.catalog] ?? imagery.catalog.book).src;
type Filter = "all" | "with_owner" | "lost" | "waiting";

/** The family and student home: search, highlights, shortcuts, belongings and shop picks. */
function FamilyHome({ user, workspace }: { user: User; workspace: Workspace }) {
  const nav = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => { api<{ products: Product[] }>("/products").then((r) => setProducts(r.products.filter((p) => p.available !== false && p.format !== "nfc"))).catch(() => {}); }, []);
  const student = user.role === "student";
  const waiting = workspace.cases.filter((c) => c.status === "awaiting_collection");
  const open = workspace.cases.filter((c) => !["returned", "closed"].includes(c.status));
  const lostIds = new Set(workspace.cases.filter((c) => !["returned", "closed"].includes(c.status)).map((c) => c.item_id));
  const statusOf = (i: Workspace["items"][number]) => waiting.some((c) => c.item_id === i.id) ? "awaiting_collection" : lostIds.has(i.id) || i.status === "lost" ? "lost" : i.status;
  const items = workspace.items.map((i) => ({ ...i, shown: statusOf(i) }));
  const filtered = items.filter((i) => filter === "all" || (filter === "with_owner" ? i.shown === "with_owner" : filter === "lost" ? i.shown === "lost" : i.shown === "awaiting_collection"));
  const hour = new Date().getHours(), hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const slides = useMemo<Slide[]>(() => [
    ...(waiting.length ? [{ kicker: waiting.length + (waiting.length === 1 ? " item is" : " items are") + " waiting", title: "Ready to", accent: "collect.", body: `At ${waiting[0]!.box_name}. Bring your FindBox confirmation.`, cta: "View", to: "/app/cases", image: imagery.features.collect.src, tone: "pop" as const }] : []),
    { kicker: "Fabric tags", title: "Every uniform,", accent: "found.", body: "Woven tags that sit in the collar and survive the wash.", cta: "Shop now", to: "/app/shop", image: imagery.hero[2]!.src },
    student
      ? { kicker: "Daily streak", title: "Keep the", accent: "flame alive.", body: "Tick today's mission and level up.", cta: "Check in", to: "/app/streaks", image: imagery.hero[1]!.src, tone: "night" as const }
      : { kicker: "Activate in seconds", title: "One code.", accent: "Whole pack.", body: "Connect every tag in your pack at once.", cta: "Activate", to: "/app/register", image: imagery.journey.connect.src, tone: "night" as const },
    { kicker: "Lost something?", title: "Report it in", accent: "two taps.", body: "Your school is told straight away.", cta: "Report", to: "/app/report", image: imagery.journey.lose.src },
  ], [waiting.length, student]);
  const badge = (id: string) => id === "complete-41" ? "Best value" : id === "uniform-12" ? "New" : id === "everyday-12" ? "Best seller" : undefined;
  return (
    <div className="pa-home">
      <div>
        <p className="pa-hello">{hello},</p>
        <h1 className="pa-name">{user.name.split(" ")[0]}</h1>
      </div>
      <form className="pa-search" role="search" onSubmit={(e) => { e.preventDefault(); const q = new FormData(e.currentTarget).get("q"); nav("/app/items" + (q ? "?q=" + encodeURIComponent(String(q)) : "")); }}>
        <Search size={18} /><input name="q" placeholder="Search your belongings" aria-label="Search your belongings" autoComplete="off" />
      </form>
      <PromoCarousel slides={slides} />
      <Shortcuts items={[
        { label: "Activate", to: "/app/register", Icon: ScanLine },
        { label: "Report lost", to: "/app/report", Icon: AlertTriangle },
        { label: "I found it", to: "/app/found", Icon: PackageCheck },
        { label: "Collect", to: "/app/cases", Icon: MapPinned, badge: waiting.length },
        student ? { label: "Streaks", to: "/app/streaks", Icon: Flame } : { label: "Children", to: "/app/children", Icon: Users },
        { label: "Shop", to: "/app/shop", Icon: ShoppingBag },
      ]} />
      <StatStrip stats={[
        { label: "Belongings", value: workspace.items.length, to: "/app/items" },
        { label: "Waiting for you", value: waiting.length, to: "/app/cases", tone: waiting.length ? "pop" : "calm" },
        { label: "Being looked for", value: open.length, to: "/app/cases", tone: open.length ? "alert" : "calm" },
        { label: "Collection points", value: workspace.boxes.length, to: "/app/boxes" },
      ]} />
      <section className="pa-home">
        <SectionHead title={student ? "My belongings" : "Your belongings"} to="/app/items" />
        <Chips label="Belongings filter" value={filter} onChange={setFilter} options={[
          { id: "all", label: "All", count: items.length },
          { id: "with_owner", label: "With you" },
          { id: "lost", label: "Lost" },
          { id: "waiting", label: "Ready to collect" },
        ]} />
        {filtered.length ? <div className="pa-grid">{filtered.slice(0, 4).map((i, n) => <ItemCard key={i.id} index={n} name={i.name} image={itemPicture(i.category)} status={i.shown} owner={i.child_name || undefined} code={i.code} to="/app/items" />)}</div>
          : <p className="pa-empty">{items.length ? "Nothing here right now." : <>No belongings yet. <Link to="/app/register">Activate your first tag</Link>.</>}</p>}
      </section>
      {products.length > 0 && <section className="pa-home">
        <SectionHead title="Shop picks" to="/app/shop" action="Shop all"><Sparkles size={16} className="pa-spark" /></SectionHead>
        <div className="pa-rail">{products.map((p, n) => <ProductCard key={p.id} index={n} id={p.id} name={p.name} subtitle={catalog.find((c) => c.serverId === p.id)?.subtitle || p.tag_count + " labels"} priceMinor={p.price_minor} image={p.image} badge={badge(p.id)} to={"/app/shop/products/" + p.id} />)}</div>
      </section>}
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
                            </> : <>
                              <Link to="/app/register"><ScanLine size={17} />Activate tags</Link>
                              <Link to="/app/report"><AlertTriangle size={17} />Report something lost</Link>
                              <Link to="/app/found"><PackageCheck size={17} />I found something</Link>
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
