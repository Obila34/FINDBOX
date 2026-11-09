import { FoundScan } from "./FoundScan";
import { Houses } from "./Houses";
import { useBackgroundRefresh } from '@/lib/useBackgroundRefresh'
import { HomeDashboard } from './HomeDashboard'
import { FamilyItems } from './FamilyItems'
import './dashboard.css'
import './school-admin.css'
import { AppDock } from '@/components/layout/AppDock'
import { ProfileStudio } from "./ProfileStudio";
import { MyAvatar } from "./profile";
import { imagery } from "@/data/imagery";
import { SiteNav } from "@/components/layout/SiteNav";
import { isAppPage } from "@/lib/standalone";
import { ThemeChoice } from "@/components/ui/ThemeToggle";
import { ServerStreaks } from "@/pages/student/ServerStreaks";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import {
  ArrowUpRight,
  ShoppingBag,
  House,
  ScanLine,
  Package,
  Bell,
  MapPin,
  Clock3,
  Check,
  School,
  PackageCheck,
  Trophy,
  ShieldCheck,
  LifeBuoy,
  Users,
  ChevronRight,
} from "lucide-react";
import {
  api,
  ApiError,
  money,
  type User,
  type Workspace,
  type Recovery,
} from "./api";
import "./platform.css";
const categories = [
  "bottle",
  "book",
  "clothing",
  "lunchbox",
  "keys",
  "sports",
  "electronics",
  "other",
];
const picture = (category: string) =>
  (imagery.catalog[category as keyof typeof imagery.catalog] ?? imagery.catalog.book).src;
const label = (s: string) => s.replaceAll("_", " ");
function Field({
  name,
  label: caption,
  type = "text",
  required = true,
  ...props
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="fp-field">
      <span>{caption}</span>
      <input name={name} type={type} required={required} {...props} />
    </label>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="fp-empty">
      <Package size={28} />
      <p>{children}</p>
    </div>
  );
}
function Countdown({ due }: { due: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const hours = Math.ceil((new Date(due).getTime() - now) / 3600000);
  return (
    <span className={"fp-countdown " + (hours <= 0 ? "fp-overdue" : "")}>
      <Clock3 size={15} />
      {hours <= 0
        ? "Collection overdue · contact staff"
        : hours >= 24
          ? `${Math.floor(hours / 24)}d ${hours % 24}h to collect`
          : `${hours}h to collect`}
    </span>
  );
}
export function Platform() {
  const location = useLocation(),
    navigate = useNavigate();
  const path = location.pathname;
  const [user, setUser] = useState<User | null>(null),
    [workspace, setWorkspace] = useState<Workspace | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<Recovery[]>([]),
    [publicTag, setPublicTag] = useState<{
      school: string;
      code: string;
      child?: string;
      boxes: Workspace["boxes"];
    } | null>(null);
  const [packMode, setPackMode] = useState(true);
  const [selectedCase, setSelectedCase] = useState(""),
    [action, setAction] = useState("receive");

  const staff = !!user && ["staff", "manager"].includes(user.role);
  const auth = [
    "/app/sign-in",
    "/app/sign-up",
    "/app/forgot",
    "/app/reset",
    "/app/verify",
  ].includes(path);
  const shop = path === "/shop";
  const publicScan = path.startsWith("/t/");
  const markRefreshed=useBackgroundRefresh(async()=>{const d=await api<Workspace>('/workspace');const changed=JSON.stringify(d)!==JSON.stringify(workspace);setWorkspace(d);setUser(d.user);return changed},!!user&&!auth&&!publicScan&&!busy,path,()=>setNotice('Your workspace updated in the background.'));
  const tabs = staff
    ? ([
        ["/manage", "Queue", House],
        ["/manage/log", "Receive", ScanLine],
        ["/manage/collect", "Hand back", PackageCheck],
        ["/app/inbox", "Inbox", Bell],
        ...(user?.role === "manager" ? [["/app/school-admin", "School", School]] as const : []),
      ] as const)
    : user?.role === "student"
    ? ([
        ["/app/home", "Home", House],
        ["/app/items", "My items", Package],
        ["/app/scan", "Scan", ScanLine],
        ["/app/houses", "Houses", Trophy],
        ["/app/inbox", "Inbox", Bell],
      ] as const)
    : ([
        ["/app/home", "Home", House],
        ["/app/items", "Items", Package],
        ["/app/scan", "Scan", ScanLine],
        ["/app/shop", "Shop", ShoppingBag],
        ["/app/inbox", "Inbox", Bell],
      ] as const);
  useEffect(() => {
    if (!selectedCase) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, a[href]') || []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCase('');
      if (event.key === 'Tab') {
        const elements = focusable(), first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [selectedCase]);
  async function reload() {
    const d = await api<Workspace>("/workspace");
    setWorkspace(d);
    setUser(d.user);
    markRefreshed();
  }
  useEffect(() => {
    let live = true;
    api<{ user: User }>("/auth/me")
      .then((d) => {
        if (live) { if ((d as {security?:{requiresMfa:boolean}}).security?.requiresMfa) {navigate("/app/sign-in");return} setUser(d.user); }
      })
      .catch((e) => {
        if (live && !(e instanceof ApiError && e.status === 401))
          setError(e.message);
      })
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    setError("");
    setNotice("");
    setSelectedCase("");
    if (user) {
      reload().catch((e) => {
        if (e.status === 401) {
          setUser(null);
          setWorkspace(null);
        }
        setError(e.message);
      });
    }
    if (path === "/app/gallery" && user)
      api<{ cases: Recovery[] }>("/gallery")
        .then((d) => setGallery(d.cases))
        .catch((e) => setError(e.message));
    if (publicScan)
      api<NonNullable<typeof publicTag>>(
        "/tags/" + encodeURIComponent(path.split("/").pop() || ""),
      )
        .then(setPublicTag)
        .catch((e) => setError(e.message));
  }, [path, user?.id]);
  useEffect(() => {
    if (loaded && !user && !auth && !shop && !publicScan)
      navigate(path.startsWith("/manage") ? "/school/sign-in" : "/app/sign-in", { replace: true });
    if (user && path === "/app")
      navigate(user.role === "manager" ? "/app/school-admin" : staff ? "/manage" : "/app/home", { replace: true });
  }, [loaded, user, path, auth, shop, publicScan, staff, navigate]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function fields(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return Object.fromEntries(
      new FormData(e.currentTarget).entries(),
    ) as Record<string, string>;
  }
  function selectCategory() {
    return (
      <label className="fp-field">
        <span>Item type</span>
        <select name="category">
          {categories.map((c) => (
            <option value={c} key={c}>
              {label(c)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const caseCards = (cases: Recovery[]) =>
    cases.length ? (
      <div className="fp-cases">
        {cases.map((c) => (
          <article className="fp-case" key={c.id}>
            <img src={picture(c.category)} alt="" />
            <div>
              <span className="fp-kicker">{label(c.status)}</span>
              <h3>{c.title}</h3>
              <p>
                <MapPin size={14} />
                {c.box_name || "Waiting to be found"}
              </p>
              {c.due_at && c.status === "awaiting_collection" && (
                <Countdown due={c.due_at} />
              )}
            </div>
            {staff && c.status !== "returned" && (
              <button
                onClick={() => {
                  setSelectedCase(c.id);
                  setAction(
                    c.status === "awaiting_collection" ? "collect" : "receive",
                  );
                }}
              >
                Manage <ArrowUpRight size={16} />
              </button>
            )}
          </article>
        ))}
      </div>
    ) : (
      <Empty>No open recoveries. Your belongings are in a good place.</Empty>
    );
  return (
    <div className="fp-root">
      {!(isAppPage(path) && !staff) && <SiteNav user={user ? { name: user.name, role: user.role } : null} cart={!user || user.role === "parent"} />}
      <main className="fp-main fb-route-enter" key={path}>
        {error && (
          <div role="alert" className="fp-alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="fp-notice">
            {notice}
          </div>
        )}
        {!loaded && !shop && !publicScan ? (
          <p role="status">Opening your FindBox…</p>
        ) : null}
        {publicScan && publicTag && (
          <section className="fp-public">
            <h1>Thank you for picking this up.</h1>
            <p>
              {publicTag.child ? `This belongs to ${publicTag.child} at ${publicTag.school}.` : `This belongs to someone at ${publicTag.school}.`}{" "}
              Hand it to a custodian at one of these collection boxes, or sign in and scan it so the family hears straight away. Owner
              details stay private.
            </p>
            <div className="fp-boxes">
              {publicTag.boxes.map((b) => (
                <article key={b.id}>
                  <MapPin />
                  <h3>{b.name}</h3>
                  <p>{b.directions}</p>
                  <small>{b.opening_hours}</small>
                </article>
              ))}
            </div>
            <Link
              className="fp-primary"
              to={"/app/scan?code=" + encodeURIComponent(publicTag.code)}
            >
              Sign in to return it <ArrowUpRight size={18} />
            </Link>
          </section>
        )}
        {user && !auth && !shop && !publicScan && workspace && (
          <>
            {!["/app/home", "/manage", "/manage/dashboard", "/app/items", "/app/shop", "/app/found", "/app/scan", "/app/houses", "/app/inbox", "/app/streaks", "/app/account"].includes(path) && !path.startsWith("/app/shop/") && <div className="fp-workspace-title">
              <div>
                <span className="fp-kicker">
                  {workspace.school?.name || "YOUR SCHOOL"}
                </span>
                <h1>
                  {`Hello, ${user.name.split(" ")[0]}.`}
                </h1>
              </div>
              <Link
                className="fp-round-link"
                to="/app/account"
                aria-label="Your account"
              >
                <MyAvatar name={user.name} size={40} />
              </Link>
            </div>}
            {!user.verified && (
              <div className="fp-notice">
                Check your email to activate your account.
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("/auth/resend", {});
                      setNotice("Verification email queued. Check your inbox.");
                    })
                  }
                >
                  Resend email
                </button>
              </div>
            )}
            {["/app/home", "/manage", "/manage/dashboard"].includes(path) && (
              <>
                <HomeDashboard user={user} workspace={workspace} staff={staff} />
                {staff && <>
                <div className="fp-section-heading">
                  <h2>The recovery queue</h2>
                  <Link to="/app/gallery">
                    Unclaimed items <ArrowUpRight size={17} />
                  </Link>
                </div>
                {caseCards(
                  workspace.cases.filter(
                    (c) => !["returned", "closed"].includes(c.status),
                  ),
                )}
                </>}
              </>
            )}
            {path === "/manage/collect" && (
              <>
                <div className="fp-section-heading"><h2>Ready to hand back</h2><Link to="/manage">Full queue <ArrowUpRight size={17} /></Link></div>
                <p className="fp-muted">Check the collector, then choose Manage and record the hand-back. The family is told straight away.</p>
                {caseCards(workspace.cases.filter((c) => c.status === "awaiting_collection"))}
              </>
            )}
            {(path === "/app/items" || path.startsWith("/app/items/")) && (
              <>
                <FamilyItems workspace={workspace} staff={staff} />
              </>
            )}
            {path === "/app/register" && (
              <section className="fp-split-panel">
                <div>
                  <h2>Activate a label pack</h2>
                  <p>
                    Use the tag ID and private activation code inside your
                    FindBox pack. Choose a category, add a name, and you’re
                    done.
                  </p>
                </div>
                <form
                  className="fp-panel"
                  onSubmit={(e) => {
                    const d = fields(e);
                    run(async () => {
                      const r = await api<{ activated?: number }>(packMode ? "/tags/activate-pack" : "/tags/activate", d);
                      await reload();
                      navigate("/app/items");
                      setNotice(
                        packMode
                          ? `${r.activated} tags activated. Give each one a name from Items whenever you like.`
                          : "Tag activated. Your belonging is now connected.",
                      );
                    });
                  }}
                >
                  <div className="fp-mode" role="group" aria-label="What are you activating?">
                    <button type="button" aria-pressed={packMode} onClick={() => setPackMode(true)}>Whole pack</button>
                    <button type="button" aria-pressed={!packMode} onClick={() => setPackMode(false)}>One tag</button>
                  </div>
                  <p className="fp-muted">{packMode ? "Enter the ID and private code of any one tag in the pack. Every tag in it activates together." : "Activate a single tag and describe the belonging now."}</p>
                  <Field
                    name="code"
                    label="Tag ID"
                    defaultValue={
                      new URLSearchParams(location.search).get("code") || ""
                    }
                  />
                  <Field
                    name="activationSecret"
                    label="Private activation code"
                    autoComplete="off"
                  />
                  {!packMode && selectCategory()}
                  <label className="fp-field">
                    <span>{packMode ? "Who are these tags for?" : "Account that owns this belonging"}</span>
                    <select name="ownerId">
                      <option value="">My account</option>
                      {workspace.children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!packMode && <Field
                    name="name"
                    label="Belonging name"
                    placeholder="Green school sweater"
                    maxLength={100}
                  />}
                  <Field
                    name="childName"
                    label="Belongs to (optional)"
                    required={false}
                    maxLength={100}
                  />
                  {!packMode && <>
                  <Field
                    name="color"
                    label="Colour (optional)"
                    required={false}
                    maxLength={60}
                  />
                  <Field
                    name="privateNote"
                    label="Private identifying detail (optional)"
                    required={false}
                    maxLength={500}
                  />
                  </>}
                  <button
                    className="fp-primary"
                    disabled={busy || !user.verified}
                  >
                    Activate & save <Check size={18} />
                  </button>
                </form>
              </section>
            )}
            {["/app/scan", "/app/found", "/manage/scan", "/manage/log"].includes(path) && (
              <div className="fs-page">
                <section>
                  <header className="fs-head">
                    <h1>{staff ? "Receive a tagged item" : new URLSearchParams(location.search).get("mode") === "add" ? "Add a belonging" : "Scan"}</h1>
                    <p>{staff ? "Scan the QR. The family is told once you confirm it is in the box." : new URLSearchParams(location.search).get("mode") === "add" ? "Stick a label on the belonging, then scan it." : "Scan a FindBox label: add your child's belongings, or return something you found."}</p>
                  </header>
                  <FoundScan staff={staff} boxes={workspace.boxes} onDone={() => void reload()} />
                </section>
              </div>
            )}
            {path === "/app/boxes" && (
              <>
                <h2>Good things find their way here.</h2>
                <p>
                  Leave found belongings with the box custodian. Collect only
                  after staff verify ownership.
                </p>
                <div className="fp-boxes">
                  {workspace.boxes.map((b) => (
                    <article key={b.id}>
                      <MapPin />
                      <h3>{b.name}</h3>
                      <p>{b.directions}</p>
                      <small>{b.opening_hours}</small>
                    </article>
                  ))}
                </div>
                {!workspace.boxes.length && (
                  <Empty>Your school has not added collection boxes yet.</Empty>
                )}
              </>
            )}
            {(path === "/app/cases" || path.startsWith("/app/cases/")) &&
              caseCards(workspace.cases)}
            {path === "/app/gallery" && (
              <>
                <h2>Missing something familiar?</h2>
                <p>
                  Describe a detail only the owner would know. School staff
                  review each claim.
                </p>
                <div className="fp-items">
                  {gallery.map((c) => (
                    <article key={c.id}>
                      <img
                        src={c.photo || picture(c.category)}
                        alt={c.photo ? "Photo of the found item" : "Category illustration"}
                      />
                      <div>
                        <h3>{c.title}</h3>
                        <p>{c.box_name}</p>
                        <form
                          onSubmit={(e) => {
                            const d = fields(e);
                            run(async () => {
                              await api("/cases/" + c.id + "/claim", d);
                              setNotice(
                                "Claim sent privately to school staff.",
                              );
                            });
                          }}
                        >
                          <Field
                            name="evidence"
                            label="Private ownership evidence"
                            maxLength={1000}
                          />
                          <button className="fp-primary" disabled={busy}>
                            Submit claim
                          </button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
                {!gallery.length && (
                  <Empty>No unclaimed items in your school right now.</Empty>
                )}
              </>
            )}
            {path === "/app/orders" && (
              <>
                <h2>Your tags, from pack to everyday.</h2>
                {workspace.orders.map((o) => (
                  <article className="fp-order" key={o.id}>
                    <div>
                      <span className="fp-kicker">{label(o.status)}</span>
                      <h3>
                        {o.lines
                          .map((l) => l.quantity + " × " + l.name)
                          .join(", ")}
                      </h3>
                      <small>
                        {new Date(o.created_at).toLocaleDateString()}
                      </small>
                    </div>
                    <strong>{money(o.amount_minor)}</strong>
                    {o.status === "pending" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api("/orders/" + o.id + "/verify", {});
                            await reload();
                            setNotice("Payment checked.");
                          })
                        }
                      >
                        Check payment
                      </button>
                    )}
                  </article>
                ))}
                {!workspace.orders.length && (
                  <Empty>
                    No orders yet. Pick your first pack in the shop.
                  </Empty>
                )}
                <h2>Your supplied tags</h2>
                {workspace.tags.map((t) => (
                  <div className="fp-order" key={t.id}>
                    <div>
                      <strong>{t.code}</strong>
                      <p>
                        {t.format} · {t.status}
                      </p>
                    </div>
                    {t.status === "allocated" && (
                      <Link
                        to={"/app/register?code=" + encodeURIComponent(t.code)}
                      >
                        Activate <ArrowUpRight size={17} />
                      </Link>
                    )}
                  </div>
                ))}
              </>
            )}
            {path === "/app/inbox" && (
              <>
                <div className="fp-section-heading">
                  <h2>Inbox</h2>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api("/notifications/read", {});
                        await reload();
                      })
                    }
                  >
                    Mark all read
                  </button>
                </div>
                {workspace.notifications.map((n) => (
                  <article
                    key={n.id}
                    className={"fp-order " + (!n.read_at ? "fp-unread" : "")}
                  >
                    <Bell size={20} />
                    <p>{n.message}</p>
                  </article>
                ))}
                {!workspace.notifications.length && (
                  <Empty>You’re all caught up.</Empty>
                )}
              </>
            )}
            {path === "/app/streaks" && <ServerStreaks personId={user.id}/>}
            {path === "/app/houses" && <Houses />}
            {(path === "/app/report" || path.startsWith("/app/report/")) && <Navigate to="/app/scan" replace />}
            {path === "/app/account" && (
              <section className="fp-account">
                <ProfileStudio role={user.role} school={workspace.school?.name}/>
                {user.role === "student" && <ServerStreaks personId={user.id} embedded/>}
                <nav className="fp-menu" aria-label="Account">
                  {(user.role === "student"
                    ? [["/app/houses", "Houses", Trophy], ["/app/security", "Settings & security", ShieldCheck], ["/app/help", "Help & support", LifeBuoy]]
                    : [["/app/children", "Children & QR", Users], ["/app/orders", "Orders & labels", ShoppingBag], ["/app/security", "Settings & security", ShieldCheck], ["/app/help", "Help & support", LifeBuoy]]
                  ).map(([to, text, Icon]) => {
                    const I = Icon as typeof Trophy;
                    return <Link key={String(to)} to={String(to)}><I size={18} /><span>{String(text)}</span><ChevronRight size={16} /></Link>;
                  })}
                </nav>
                <div className="fp-account-row"><ThemeChoice /><button type="button" className="fp-signout" disabled={busy} onClick={() => run(async () => { await api("/auth/logout", {}); setUser(null); setWorkspace(null); navigate("/app/sign-in", { replace: true }); })}>Sign out</button></div>
                <p className="fp-account-meta">{user.email}{user.verified ? "" : " · check your email to verify"}</p>
              </section>
            )}
            {staff &&
              workspace.claims.some((c) => c.status === "submitted") &&
              path === "/manage" && (
                <section>
                  <h2>Claims to review</h2>
                  {workspace.claims
                    .filter((c) => c.status === "submitted")
                    .map((c) => (
                      <article key={c.id} className="fp-panel">
                        <h3>
                          {
                            workspace.cases.find((x) => x.id === c.case_id)
                              ?.title
                          }
                        </h3>
                        <p>{c.evidence}</p>
                        <div className="fp-actions">
                          {["approved", "rejected"].map((decision) => (
                            <button
                              key={decision}
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  await api("/staff/claims/" + c.id, {
                                    decision,
                                  });
                                  await reload();
                                  setNotice("Claim " + decision);
                                })
                              }
                            >
                              {decision === "approved"
                                ? "Verify ownership"
                                : "Reject claim"}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                </section>
              )}
            {selectedCase && staff && (
              <div className="fp-modal">
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="case-title"
                  className="fp-panel"
                >
                  <button
                    onClick={() => setSelectedCase("")}
                    className="fp-close"
                    aria-label="Close case actions"
                  >
                    ×
                  </button>
                  <h2 id="case-title">
                    {workspace.cases.find((c) => c.id === selectedCase)?.title}
                  </h2>
                  <p>
                    Confirm physical receipt or check ownership before release.
                  </p>
                  <form
                    onSubmit={(e) => {
                      const d = fields(e);
                      run(async () => {
                        await api(
                          "/staff/cases/" + selectedCase + "/" + action,
                          action === "extend"
                            ? { ...d, days: Number(d.days) }
                            : d,
                        );
                        setSelectedCase("");
                        await reload();
                        setNotice("Case updated.");
                      });
                    }}
                  >
                    {action === "receive" ? (
                      <label className="fp-field">
                        <span>Confirmed collection box</span>
                        <select name="boxId">
                          {workspace.boxes.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : action === "collect" ? (
                      <Field
                        name="verification"
                        label="How did you verify the collector’s ownership?"
                        maxLength={500}
                      />
                    ) : (
                      <>
                        <Field
                          name="days"
                          label="Extra days (1–30)"
                          type="number"
                        />
                        <Field
                          name="reason"
                          label="Reason for extension"
                          maxLength={500}
                        />
                      </>
                    )}
                    <button className="fp-primary" disabled={busy}>
                      {action === "receive"
                        ? "Confirm receipt & notify owner"
                        : action === "collect"
                          ? "Confirm safe collection"
                          : "Extend deadline"}
                    </button>
                  </form>
                  {action === "collect" && (
                    <button onClick={() => setAction("extend")}>
                      Extend the collection deadline instead
                    </button>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>
      {user && !staff && !auth && !publicScan && <AppDock role={user.role} unread={workspace?.notifications.filter(n=>!n.read_at).length}/>}
      {user && staff && !auth && !publicScan && (
        <nav className="fp-dock" aria-label="App navigation">
          {tabs.map(([url, title, Icon]) => (
            <Link
              key={url}
              to={url}
              className={path === url ? "active" : ""}
              aria-current={path === url ? "page" : undefined}
            >
              <Icon size={21} />
              <span>{title}</span>
            </Link>
          ))}
        </nav>
      )}
      {!(isAppPage(path) && !staff) && <footer className="fp-footer">
        <span className="fb-wordmark">FINDBOX</span>
        <Link to="/app/boxes">Collection boxes</Link>
        <Link to="/shop">Find your tags</Link>
      </footer>}

    </div>
  );
}
