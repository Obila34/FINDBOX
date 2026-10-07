import { ProfileMenu } from '@/components/layout/ProfileMenu'
import { AppDock } from '@/components/layout/AppDock'
import { ServerStreaks } from "@/pages/student/ServerStreaks";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ShoppingBag,
  House,
  ScanLine,
  Package,
  Bell,
  MapPin,
  ShieldCheck,
  Clock3,
  Check,
  ArrowLeft,
  Plus,
  Minus,
} from "lucide-react";
import {
  api,
  ApiError,
  money,
  type User,
  type Product,
  type Workspace,
  type Recovery,
} from "./api";
import { PwaStatus } from "@/components/layout/PwaStatus";
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
  "/media/catalog/" +
  (["bottle", "book", "clothing", "lunchbox"].includes(category)
    ? category
    : "book") +
  "-480.webp";
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
  const [products, setProducts] = useState<Product[]>([]),
    [checkoutEnabled, setCheckoutEnabled] = useState(false),
    [cart, setCart] = useState<Record<string, number>>({}),
    [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [gallery, setGallery] = useState<Recovery[]>([]),
    [publicTag, setPublicTag] = useState<{
      school: string;
      code: string;
      boxes: Workspace["boxes"];
    } | null>(null);
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
  const tabs = staff
    ? ([
        ["/manage", "Queue", House],
        ["/manage/log", "Receive", ScanLine],
        ["/app/boxes", "Boxes", MapPin],
        ["/app/inbox", "Inbox", Bell],
      ] as const)
    : ([
        ["/app/home", "Home", House],
        ["/app/items", "Items", Package],
        ["/app/register", "Activate", ScanLine],
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
    if (shop)
      api<{ products: Product[]; checkoutEnabled: boolean }>("/products")
        .then((d) => {
          setProducts(d.products);
          setCheckoutEnabled(d.checkoutEnabled);
        })
        .catch((e) => setError(e.message));
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
      navigate("/app/sign-in", { replace: true });
    if (user && path === "/app")
      navigate(staff ? "/manage" : "/app/home", { replace: true });
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
  async function submitAuth(e: FormEvent<HTMLFormElement>) {
    const d = fields(e);
    await run(async () => {
      if (path === "/app/forgot") {
        const r = await api<{ message: string }>("/auth/forgot", d);
        setNotice(r.message);
        return;
      }
      if (path === "/app/reset" || path === "/app/verify") {
        const token =
          new URLSearchParams(location.hash.slice(1)).get("token") || "";
        await api("/auth/" + (path.endsWith("reset") ? "reset" : "verify"), {
          ...d,
          token,
        });
        navigate("/app/sign-in");
        setNotice(
          path.endsWith("reset")
            ? "Password changed. Sign in again."
            : "Email verified. You can now activate tags.",
        );
        return;
      }
      const r = await api<{ user: User }>(
        "/auth/" + (path.endsWith("sign-up") ? "signup" : "login"),
        d,
      );
      setUser(r.user);
      navigate(
        ["staff", "manager"].includes(r.user.role) ? "/manage" : "/app/home",
      );
    });
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
  const total = products.reduce(
    (sum, p) => sum + p.price_minor * (cart[p.id] || 0),
    0,
  );
  const unpaidPayment = new URLSearchParams(location.search).get("payment");
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
      <header className="fp-header">
        <Link to="/" className="fb-wordmark">
          FINDBOX
        </Link>
        {user ? <ProfileMenu name={user.name}/> : <Link to="/app/sign-in">Sign in</Link>}
      </header>
      <main className="fp-main">
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
        {auth && (
          <div className="fp-auth">
            <section className="fp-auth-art">
              <span className="fp-kicker">LESS WORRY. MORE FOUND.</span>
              <h1>
                Every little thing.
                <br />A way back home.
              </h1>
              <img
                src="/media/avatars/findbox-explorer-640.webp"
                alt="FindBox explorer waving"
              />
              <p>Your tags. Your belongings. Your school, connected.</p>
            </section>
            <section className="fp-auth-form">
              <Link to="/" className="fp-back">
                <ArrowLeft size={16} />
                Back to FindBox
              </Link>
              <span className="fp-kicker">YOUR FINDBOX ACCOUNT</span>
              <h1>
                {path.endsWith("sign-up")
                  ? "Make yourself at home."
                  : path.endsWith("forgot")
                    ? "Let’s get you back in."
                    : path.endsWith("reset")
                      ? "A fresh start."
                      : path.endsWith("verify")
                        ? "One last step."
                        : "Good to have you back."}
              </h1>
              <p>
                {path.endsWith("sign-up")
                  ? "Buy a pack. Activate your tags. Leave the uploading behind."
                  : path.endsWith("verify")
                    ? "Confirm your email to begin protecting your belongings."
                    : "One account for your school day."}
              </p>
              <form onSubmit={submitAuth}>
                {path.endsWith("sign-up") && (
                  <>
                    <Field
                      name="name"
                      label="Your name"
                      autoComplete="name"
                      maxLength={100}
                    />
                    <label className="fp-field">
                      <span>I am a</span>
                      <select name="role">
                        <option value="parent">Parent / guardian</option>
                        <option value="student">Student</option>
                      </select>
                    </label>
                    <Field
                      name="schoolCode"
                      label="School invitation code"
                      maxLength={100}
                    />
                  </>
                )}
                {!path.endsWith("reset") && !path.endsWith("verify") && (
                  <Field
                    name="email"
                    label="Email address"
                    type="email"
                    autoComplete="email"
                  />
                )}
                {!path.endsWith("forgot") && !path.endsWith("verify") && (
                  <Field
                    name="password"
                    label="Password"
                    type="password"
                    minLength={path.endsWith("sign-in") ? 1 : 12}
                    maxLength={128}
                    autoComplete={
                      path.endsWith("sign-in")
                        ? "current-password"
                        : "new-password"
                    }
                  />
                )}
                {(path.endsWith("sign-up") || path.endsWith("reset")) && (
                  <small>Use at least 12 characters.</small>
                )}
                <button className="fp-primary" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : path.endsWith("sign-up")
                      ? "Create account"
                      : path.endsWith("forgot")
                        ? "Send reset link"
                        : path.endsWith("reset")
                          ? "Save password"
                          : path.endsWith("verify")
                            ? "Verify email"
                            : "Sign in"}
                  <ArrowUpRight size={18} />
                </button>
              </form>
              <div className="fp-auth-links">
                <Link to="/app/sign-up">Create an account</Link>
                <Link to="/app/forgot">Forgot password?</Link>
                <Link to="/app/sign-in">Sign in</Link>
              </div>
              <p className="fp-muted">
                Teachers use the account issued by their school.
              </p>
            </section>
          </div>
        )}
        {shop && (
          <>
            <section className="fp-shop-hero">
              <div>
                <span className="fp-kicker">
                  SMALL TAGS. BIG PEACE OF MIND.
                </span>
                <h1>
                  Made to stick.
                  <br />
                  <em>Built to come back.</em>
                </h1>
                <p>
                  For the uniform that looks like everyone else’s. The favourite
                  bottle. The bag that goes everywhere.
                </p>
                <a href="#tag-packs" className="fp-primary">
                  Find your pack <ArrowUpRight size={18} />
                </a>
                <div className="fp-assurances">
                  <span>
                    <ShieldCheck size={16} />
                    Private by design
                  </span>
                  <span>
                    <Check size={16} />
                    No mandatory photos
                  </span>
                </div>
              </div>
              <div className="fp-shop-art">
                <span className="fp-orbit" />
                <img
                  src="/media/objects/bottle-1280.webp"
                  alt="Clear water bottle"
                />
                <img
                  src="/media/objects/nfc-640.webp"
                  alt="NFC identification tag"
                />
                <span className="fp-float-label">
                  A little label.
                  <br />A lasting connection.
                </span>
              </div>
            </section>
            <div className="fp-steps">
              {[
                "Choose your pack",
                "Collect at school",
                "Activate & assign",
                "Find your way back",
              ].map((s, i) => (
                <div key={s}>
                  <span>0{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>
            <section id="tag-packs">
              <div className="fp-section-heading">
                <div>
                  <span className="fp-kicker">THE TAG COLLECTION</span>
                  <h2>A place for every belonging.</h2>
                </div>
                <p>
                  One-time tag purchase.
                  <br />
                  School collection included. Tags only; belongings shown for
                  illustration.
                </p>
              </div>
              <div className="fp-products">
                {products.map((p) => (
                  <article key={p.id}>
                    <div className="fp-product-art">
                      <span>{p.tag_count} unique tags</span>
                      <img src={p.image} alt={p.name} loading="lazy" />
                    </div>
                    <div className="fp-product-copy">
                      <span className="fp-kicker">
                        {p.format === "nfc" ? "TAP OR SCAN" : "SCAN & RETURN"}
                      </span>
                      <h3>{p.name}</h3>
                      <p>{p.description}</p>
                      <div>
                        <strong>{money(p.price_minor)}</strong>
                        <button
                          aria-label={"Add " + p.name}
                          onClick={() => {
                            setCart({
                              ...cart,
                              [p.id]: Math.min(10, (cart[p.id] || 0) + 1),
                            });
                            setRequestKey(crypto.randomUUID());
                          }}
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!products.length && !error && (
                <p role="status">Loading the collection…</p>
              )}
            </section>
            <section className="fp-cart">
              <div>
                <span className="fp-kicker">YOUR EVERYDAY ESSENTIALS</span>
                <h2>Your bag.</h2>
                {products
                  .filter((p) => cart[p.id])
                  .map((p) => (
                    <div className="fp-cart-line" key={p.id}>
                      <span>{p.name}</span>
                      <div>
                        <button
                          aria-label={"Remove one " + p.name}
                          onClick={() => {
                            setCart({
                              ...cart,
                              [p.id]: Math.max(0, cart[p.id] - 1),
                            });
                            setRequestKey(crypto.randomUUID());
                          }}
                        >
                          <Minus size={16} />
                        </button>
                        <span>{cart[p.id]}</span>
                        <button
                          aria-label={"Add one " + p.name}
                          onClick={() => {
                            setCart({
                              ...cart,
                              [p.id]: Math.min(10, cart[p.id] + 1),
                            });
                            setRequestKey(crypto.randomUUID());
                          }}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <strong>{money(p.price_minor * cart[p.id])}</strong>
                    </div>
                  ))}
                {!total && <p>Choose a pack above to get started.</p>}
              </div>
              <div>
                <h3>{money(total)}</h3>
                <p>
                  Collect your pack through your school. Your tag activation
                  codes arrive inside the packaging.
                </p>
                {!user ? (
                  <Link className="fp-primary" to="/app/sign-in">
                    Sign in to checkout <ArrowUpRight size={18} />
                  </Link>
                ) : (
                  <button
                    className="fp-primary"
                    disabled={
                      busy || !total || !checkoutEnabled || !user.verified
                    }
                    onClick={() =>
                      run(async () => {
                        const r = await api<{ url: string }>("/orders", {
                          requestKey,
                          lines: Object.entries(cart)
                            .filter(([, q]) => q > 0)
                            .map(([productId, quantity]) => ({
                              productId,
                              quantity,
                            })),
                        });
                        window.location.assign(r.url);
                      })
                    }
                  >
                    Secure checkout <ArrowUpRight size={18} />
                  </button>
                )}
                {!checkoutEnabled && (
                  <small>
                    Ordering opens when payment and tag supply are connected.
                  </small>
                )}
                {user && !user.verified && (
                  <small>Verify your email before checkout.</small>
                )}
              </div>
            </section>
            {unpaidPayment && user && (
              <section className="fp-panel">
                <h3>Check your payment</h3>
                <p>
                  FindBox confirms your payment directly with the provider
                  before preparing tags.
                </p>
                <button
                  disabled={busy}
                  className="fp-primary"
                  onClick={() =>
                    run(async () => {
                      const r = await api<{ status: string }>(
                        "/orders/" +
                          encodeURIComponent(unpaidPayment) +
                          "/verify",
                        {},
                      );
                      setNotice("Order status: " + r.status);
                      await reload();
                    })
                  }
                >
                  Check payment status
                </button>
              </section>
            )}
          </>
        )}
        {publicScan && publicTag && (
          <section className="fp-public">
            <span className="fp-kicker">YOU FOUND SOMETHING THAT MATTERS.</span>
            <h1>
              A small kindness.
              <br />A big difference.
            </h1>
            <p>
              This tag belongs to the {publicTag.school} community. Leave the
              item with a custodian at one of these collection boxes. Owner
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
              to={"/app/found?code=" + encodeURIComponent(publicTag.code)}
            >
              Sign in to report a drop-off <ArrowUpRight size={18} />
            </Link>
          </section>
        )}
        {user && !auth && !shop && !publicScan && workspace && (
          <>
            <div className="fp-workspace-title">
              <div>
                <span className="fp-kicker">
                  {workspace.school?.name || "YOUR SCHOOL"} / {user.role}
                </span>
                <h1>
                  {staff
                    ? "A little care. A lot more found."
                    : `Hello, ${user.name.split(" ")[0]}.`}
                </h1>
              </div>
              <Link
                className="fp-round-link"
                to="/app/account"
                aria-label="Your account"
              >
                {user.name.slice(0, 1)}
              </Link>
            </div>
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
                <section className="fp-home-hero">
                  <div>
                    <span className="fp-kicker">
                      EVERYTHING, A LITTLE CLOSER.
                    </span>
                    <h2>
                      {staff
                        ? "A clear path from found to home."
                        : "Less looking.\nMore living."}
                    </h2>
                    <p>
                      {staff
                        ? "Confirm box deposits, check claims and record safe returns."
                        : "Give the things you love a way to find you again."}
                    </p>
                    <Link
                      to={staff ? "/manage/log" : "/app/register"}
                      className="fp-primary"
                    >
                      {staff ? "Receive an item" : "Activate a tag"}
                      <ArrowUpRight size={18} />
                    </Link>
                  </div>
                  <img
                    src={
                      staff
                        ? "/media/objects/airtag-640.webp"
                        : "/media/avatars/findbox-explorer-640.webp"
                    }
                    alt=""
                  />
                </section>
                <div className="fp-metrics">
                  <Link to="/app/items">
                    <strong>{workspace.items.length}</strong>Belongings
                  </Link>
                  <Link to={staff ? "/manage" : "/app/cases"}>
                    <strong>
                      {
                        workspace.cases.filter(
                          (c) => !["returned", "closed"].includes(c.status),
                        ).length
                      }
                    </strong>
                    Open recoveries
                  </Link>
                  <Link to="/app/boxes">
                    <strong>{workspace.boxes.length}</strong>Collection boxes
                  </Link>
                </div>
                <div className="fp-section-heading">
                  <h2>{staff ? "The recovery queue" : "On the way home"}</h2>
                  <Link to="/app/gallery">
                    Unclaimed items <ArrowUpRight size={17} />
                  </Link>
                </div>
                {caseCards(
                  workspace.cases.filter(
                    (c) => !["returned", "closed"].includes(c.status),
                  ),
                )}
                <div className="fp-quick-links">
                  <Link to="/app/found">
                    <ScanLine />
                    Found something?
                  </Link>

                  <Link to="/app/orders">
                    <ShoppingBag />
                    Your orders & tags
                  </Link>
                </div>
              </>
            )}
            {(path === "/app/items" || path.startsWith("/app/items/") || path === "/app/report" || path.startsWith("/app/report/")) && (
              <>
                <div className="fp-section-heading">
                  <h2>Your everyday collection.</h2>
                  <Link to="/app/register">
                    Activate a tag <Plus size={18} />
                  </Link>
                </div>
                <div className="fp-items">
                  {workspace.items.map((i) => (
                    <article key={i.id}>
                      <img
                        src={picture(i.category)}
                        alt={i.category + " illustration"}
                        loading="lazy"
                      />
                      <div>
                        <span className="fp-kicker">{label(i.status)}</span>
                        <h3>{i.name}</h3>
                        <p>
                          {[i.child_name, i.color]
                            .filter(Boolean)
                            .join(" · ") || label(i.category)}
                        </p>
                        <small>{i.code}</small>
                        {!staff && i.status === "with_owner" && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await api("/items/" + i.id + "/lost", {});
                                await reload();
                                setNotice("Lost report sent to your school.");
                              })
                            }
                          >
                            Report lost <ArrowUpRight size={16} />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {!workspace.items.length && (
                  <Empty>
                    Activate your first tag to add a belonging. No photo upload
                    needed.
                  </Empty>
                )}
              </>
            )}
            {path === "/app/register" && (
              <section className="fp-split-panel">
                <div>
                  <span className="fp-kicker">FROM TAG TO BELONGING</span>
                  <h2>
                    Scan. Name.
                    <br />
                    Make it yours.
                  </h2>
                  <p>
                    Use the tag ID and private activation code inside your
                    FindBox pack. Choose a category, add a name, and you’re
                    done.
                  </p>
                  <img src="/media/objects/nfc-640.webp" alt="NFC tag" />
                </div>
                <form
                  className="fp-panel"
                  onSubmit={(e) => {
                    const d = fields(e);
                    run(async () => {
                      await api("/tags/activate", d);
                      await reload();
                      navigate("/app/items");
                      setNotice(
                        "Tag activated. Your belonging is now connected.",
                      );
                    });
                  }}
                >
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
                  {selectCategory()}
                  <label className="fp-field">
                    <span>Account that owns this belonging</span>
                    <select name="ownerId">
                      <option value="">My account</option>
                      {workspace.children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    name="name"
                    label="Belonging name"
                    placeholder="Green school sweater"
                    maxLength={100}
                  />
                  <Field
                    name="childName"
                    label="Belongs to (optional)"
                    required={false}
                    maxLength={100}
                  />
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
                  <button
                    className="fp-primary"
                    disabled={busy || !user.verified}
                  >
                    Activate & save <Check size={18} />
                  </button>
                </form>
              </section>
            )}
            {["/app/found", "/manage/scan", "/manage/log"].includes(path) && (
              <div className="fp-two-columns">
                <section className="fp-panel">
                  <span className="fp-kicker">A GOOD DEED STARTS HERE</span>
                  <h2>Found a tagged item?</h2>
                  <p>
                    Scan the printed QR with your phone camera, then enter its
                    tag ID here. Staff confirm the physical deposit before
                    notifying the owner.
                  </p>
                  <form
                    onSubmit={(e) => {
                      const d = fields(e);
                      run(async () => {
                        const r = await api<{ message: string }>("/found", d);
                        setNotice(r.message);
                        await reload();
                      });
                    }}
                  >
                    <Field
                      name="code"
                      label="Tag ID"
                      defaultValue={
                        new URLSearchParams(location.search).get("code") || ""
                      }
                    />
                    <label className="fp-field">
                      <span>Collection box</span>
                      <select name="boxId" required>
                        {workspace.boxes.map((b) => (
                          <option value={b.id} key={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="fp-primary"
                      disabled={busy || !workspace.boxes.length}
                    >
                      Report drop-off <ArrowUpRight size={18} />
                    </button>
                  </form>
                </section>
                {staff ? (
                  <section className="fp-panel">
                    <h2>No tag? Still welcome.</h2>
                    <p>
                      Add a short description. Keep one identifying detail
                      private for ownership checks.
                    </p>
                    <form
                      onSubmit={(e) => {
                        const d = fields(e);
                        run(async () => {
                          await api("/staff/unclaimed", d);
                          await reload();
                          setNotice(
                            "Unclaimed item added to your school gallery.",
                          );
                        });
                      }}
                    >
                      <Field
                        name="title"
                        label="Public description"
                        maxLength={100}
                      />
                      {selectCategory()}
                      <Field
                        name="privateNote"
                        label="Private identifying detail"
                        maxLength={500}
                      />
                      <label className="fp-field">
                        <span>Stored in</span>
                        <select name="boxId" required>
                          {workspace.boxes.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button disabled={busy} className="fp-primary">
                        Log untagged item
                      </button>
                    </form>
                  </section>
                ) : (
                  <section className="fp-panel">
                    <img
                      className="fp-feature-image"
                      src="/media/objects/bottle-640.webp"
                      alt="Water bottle"
                    />
                    <h2>Not a tag in sight?</h2>
                    <p>
                      Hand the item to your school box custodian. They’ll add it
                      to the unclaimed gallery.
                    </p>
                    <Link to="/app/boxes">
                      Find a collection box <ArrowUpRight size={18} />
                    </Link>
                  </section>
                )}
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
                        src={picture(c.category)}
                        alt="Category illustration"
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
                  <h2>Good news lives here.</h2>
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
            {path === "/app/account" && (
              <section className="fp-panel">
                <h2>{user.name}</h2><p><Link to="/app/security">Profile settings &amp; security <ArrowUpRight size={16}/></Link></p>{user.role==='student'&&<ServerStreaks personId={user.id} embedded/>}<p><Link to="/app/help">Help &amp; Support</Link> · <Link to="/app/feedback">Feedback</Link> · <Link to="/app/refer">Refer FindBox</Link></p>
                <p>{user.email}</p>
                <p>
                  {label(user.role)} · {workspace.school?.name}
                </p>
                <p>
                  Email {user.verified ? "verified" : "awaiting verification"}
                </p>
                {user.role === "parent" && (
                  <>
                    <h3>Family connections</h3>
                    <p>
                      {workspace.children.length
                        ? workspace.children.map((c) => c.name).join(", ")
                        : "No student accounts linked yet."}
                    </p>
                    <button
                      disabled={busy}
                      className="fp-primary"
                      onClick={() =>
                        run(async () => {
                          const r = await api<{ code: string }>(
                            "/family/invite",
                            {},
                          );
                          setNotice(
                            "Share this one-use code with your child: " +
                              r.code +
                              ". It expires in 24 hours.",
                          );
                        })
                      }
                    >
                      Invite your child
                    </button>
                  </>
                )}
                {user.role === "student" && (
                  <form
                    onSubmit={(e) => {
                      const d = fields(e);
                      run(async () => {
                        await api("/family/link", d);
                        await reload();
                        setNotice("Parent account linked.");
                      });
                    }}
                  >
                    <Field
                      name="code"
                      label="Private invitation from your parent"
                    />
                    <button disabled={busy} className="fp-primary">
                      Link parent
                    </button>
                  </form>
                )}
                <Link to="/app/orders">
                  Orders & tags <ArrowUpRight size={16} />
                </Link>
                <Link to="/app/forgot">
                  Reset password <ArrowUpRight size={16} />
                </Link>
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
      {user && !staff && !auth && !publicScan && <AppDock unread={workspace?.notifications.filter(n=>!n.read_at).length}/>}
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
      <footer className="fp-footer">
        <span className="fb-wordmark">FINDBOX</span>
        <p>Less worry. More found.</p>
        <Link to="/app/boxes">Collection boxes</Link>
        <Link to="/shop">Find your tags</Link>
      </footer>
      <PwaStatus />
    </div>
  );
}
