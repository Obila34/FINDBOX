import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowLeft,
  Minus,
  Plus,
  ShieldCheck,
  Package,
  Smartphone,
  CreditCard,
} from "lucide-react";
import {
  api,
  ApiError,
  money,
  type Product,
  type User,
  type Workspace,
} from "@/platform/api";
import { MarketHeader } from "@/components/layout/MarketHeader";
import FooterBlock from "@/components/ui/footer-3";
import { AppShopNav } from "./AppShopNav";
import { useServerCart } from "./serverCart";
import "./store-base.css";
import "./storefront.css";
import "@/platform/account.css";
export function ServerStorefront() {
  const location = useLocation(),
    nav = useNavigate(),
    inApp = location.pathname.startsWith("/app/shop"),
    base = inApp ? "/app/shop" : "/shop",
    path = location.pathname.replace(/^\/app\/shop/, "/shop");
  const cart = useServerCart();
  const [products, setProducts] = useState<Product[]>([]),
    [user, setUser] = useState<User | null>(null),
    [workspace, setWorkspace] = useState<Workspace | null>(null),
    [checkoutEnabled, setCheckoutEnabled] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [code, setCode] = useState("");
  async function reload() {
    setWorkspace(await api<Workspace>("/workspace"));
  }
  useEffect(() => {
    let live = true;
    if (cart.method !== "mpesa") cart.choose("mpesa");
    Promise.all([
      api<{ products: Product[]; checkoutEnabled: boolean }>("/products"),
      api<{ user: User; security?: { requiresMfa: boolean } }>(
        "/auth/me",
      ).catch((e) => {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }),
    ])
      .then(async ([p, u]) => {
        if (!live) return;
        setProducts(p.products);
        setCheckoutEnabled(p.checkoutEnabled);
        if (u?.security?.requiresMfa) {
          nav("/app/sign-in");
          return;
        }
        setUser(u?.user || null);
        if (u) {
          const w = await api<Workspace>("/workspace");
          if (live) setWorkspace(w);
        }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    setNotice("");
    setError("");
  }, [path]);
  const product = products.find((p) => path === "/shop/products/" + p.id),
    order = workspace?.orders.find((o) => path === "/shop/orders/" + o.id),
    lines = products.filter((p) => cart.lines[p.id] > 0),
    total = lines.reduce((n, p) => n + p.price_minor * cart.lines[p.id], 0);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function add(p: Product) {
    cart.change(p.id, (cart.lines[p.id] || 0) + 1);
    setNotice(p.name + " added to your bag.");
  }
  function checkout(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const r = await api<{ url: string; orderId: string }>("/orders", {
        requestKey: cart.key,
        paymentMethod: cart.method,
        lines: lines.map((p) => ({
          productId: p.id,
          quantity: cart.lines[p.id],
        })),
      });
      const url = new URL(r.url);
      if (url.origin !== "https://checkout.paystack.com")
        throw new Error("Payment provider returned an unexpected address");
      window.location.assign(r.url);
    });
  }
  function activate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    void run(async () => {
      await api("/tags/activate", { ...values, code });
      setCode("");
      setNotice("Your belonging is connected. Open Items in the app.");
      await reload();
    });
  }
  const signIn = (
    <div className="fc-empty">
      <h1>
        All yours.
        <br />
        All connected.
      </h1>
      <p>Sign in to access your orders and tags.</p>
      <button
        className="fp-primary"
        onClick={() =>
          nav("/app/sign-in", { state: { from: location.pathname } })
        }
      >
        Sign in to continue <ArrowUpRight size={18} />
      </button>
    </div>
  );
  const cards = (
    <div className="fc-products">
      {products.map((p) => (
        <article key={p.id} className="fc-product">
          <Link
            to={base + "/products/" + p.id}
            className="fc-product-image"
            style={{
              background: p.format === "fabric" ? "#f0ddc9" : "#dce4d2",
            }}
          >
            <span>{p.tag_count} individual tags</span>
            <img src={p.image} alt={p.name} loading="lazy" />
          </Link>
          <div className="fc-product-caption">
            <span className="fp-kicker">{p.format}</span>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <strong>{money(p.price_minor)}</strong>
          </div>
        </article>
      ))}
    </div>
  );
  return (
    <div className={"fc-root fb-landing" + (inApp ? " fc-in-app" : "")}>
      <MarketHeader />
      <main className="fc-main" id="main">
        {error && (
          <p role="alert" className="fp-alert">
            {error}
          </p>
        )}
        {notice && (
          <div role="status" className="fp-notice">
            {notice}
            <Link to={base + "/cart"}>
              View bag <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
        {!loaded && <p role="status">Opening the store…</p>}
        {path === "/shop" && !inApp && (
          <>
            <section className="fp-shop-hero">
              <div>
                <span className="fp-kicker">THE FINDBOX COLLECTION</span>
                <h1>
                  Little labels.
                  <br />
                  <em>Big peace of mind.</em>
                </h1>
                <p>
                  For the things that go everywhere. Shop your tags, connect
                  your belongings and find your way back.
                </p>
                <Link className="fp-primary" to={base + "/catalog"}>
                  Find your tags <ArrowUpRight size={18} />
                </Link>
              </div>
              <div className="fp-shop-art">
                <span className="fp-orbit" />
                <img
                  src="/media/objects/bottle-1280.webp"
                  alt="A bottle with a FindBox label"
                />
                <img src="/media/objects/nfc-640.webp" alt="NFC tag" />
              </div>
            </section>
            {cards}
            <section className="fc-app-story">
              <div>
                <span className="fp-kicker">A TAG IS JUST THE BEGINNING</span>
                <h2>
                  One connected
                  <br />
                  school day.
                </h2>
                <p>
                  The same account. Your orders, belongings and school
                  collections.
                </p>
                <Link className="fp-primary" to="/app/home">
                  Open your FindBox <ArrowUpRight size={18} />
                </Link>
              </div>
              <img
                src="/media/avatars/findbox-explorer-640.webp"
                alt="FindBox explorer"
                loading="lazy"
              />
            </section>
          </>
        )}
        {(path === "/shop/catalog" || inApp && path === "/shop") && (
          <>
            <div className="fc-page-heading">
              <span className="fp-kicker">SMALL THINGS, SORTED</span>
              <h1>{inApp ? "Shop tags" : "A place for every tag."}</h1>
            </div>
            {cards}
          </>
        )}
        {product && (
          <>
            <Link className="fc-back" to={base + "/catalog"}>
              <ArrowLeft size={16} />
              All tags
            </Link>
            <section className="fc-product-detail">
              <div className="fc-product-stage">
                <img src={product.image} alt={product.name} />
              </div>
              <div>
                <span className="fp-kicker">
                  {product.tag_count} INDIVIDUAL TAGS
                </span>
                <h1>{product.name}</h1>
                <p>{product.description}</p>
                <h2>{money(product.price_minor)}</h2>
                <button className="fp-primary" onClick={() => add(product)}>
                  Add to bag <Plus size={18} />
                </button>
                <p>
                  QR and NFC identify belongings when scanned. They do not
                  provide live GPS tracking.
                </p>
              </div>
            </section>
          </>
        )}
        {path === "/shop/cart" && (
          <>
            <div className="fc-page-heading">
              <h1>Your good finds.</h1>
            </div>
            {lines.length ? (
              <div className="fc-checkout-grid">
                <section>
                  {lines.map((p) => (
                    <article key={p.id} className="fc-bag-line">
                      <img src={p.image} alt={p.name} />
                      <div>
                        <h3>{p.name}</h3>
                        <div className="fc-quantity">
                          <button
                            aria-label={"Remove one " + p.name}
                            onClick={() =>
                              cart.change(p.id, cart.lines[p.id] - 1)
                            }
                          >
                            <Minus size={16} />
                          </button>
                          <span>{cart.lines[p.id]}</span>
                          <button
                            aria-label={"Add one " + p.name}
                            onClick={() =>
                              cart.change(p.id, cart.lines[p.id] + 1)
                            }
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                      <strong>{money(p.price_minor * cart.lines[p.id])}</strong>
                    </article>
                  ))}
                </section>
                <aside className="fc-summary">
                  <h2>Your bag.</h2>
                  <div className="fc-total">
                    <span>Total</span>
                    <strong>{money(total)}</strong>
                  </div>
                  <Link className="fp-primary" to={base + "/checkout"}>
                    Continue to checkout <ArrowUpRight size={18} />
                  </Link>
                </aside>
              </div>
            ) : (
              <div className="fc-empty">
                <Package />
                <h2>Your bag is waiting.</h2>
                <Link to={base + "/catalog"}>Explore the collection</Link>
              </div>
            )}
          </>
        )}
        {path === "/shop/checkout" &&
          (user ? (
            <>
              <div className="fc-page-heading">
                <h1>Make it yours.</h1>
              </div>
              <form className="fc-checkout-grid" onSubmit={checkout}>
                <section className="fc-checkout-sections">
                  <section>
                    <h3>{user.name}</h3>
                    <p>
                      {workspace?.school?.name ||
                        "Join a school in account security to choose a collection point."}
                    </p>
                    <Link to="/app/security">Manage schools and security</Link>
                  </section>
                  <section>
                    <h3>Your way to pay.</h3>
                    <div className="fc-payment-options">
                      {(["mpesa"] as const).map((m) => (
                        <label
                          key={m}
                          className={cart.method === m ? "active" : ""}
                        >
                          <input
                            type="radio"
                            name="method"
                            checked={cart.method === m}
                            onChange={() => cart.choose(m)}
                          />
                          {m === "mpesa" ? <Smartphone /> : <CreditCard />}
                          <strong>{m === "mpesa" ? "M-Pesa" : "Card"}</strong>
                        </label>
                      ))}
                    </div>
                    <p>
                      M-Pesa is available for launch. Card payments will follow later. Continue to secure checkout.
                      FindBox never asks for your M-Pesa PIN or stores card
                      details.
                    </p>
                    {!checkoutEnabled && (
                      <p role="status">
                        Payments are not open yet. Your bag is saved.
                      </p>
                    )}
                    {user.role === "student" && (
                      <p role="status">
                        Ask your parent or guardian to buy your tags. Students
                        cannot make payments.
                      </p>
                    )}
                    {!user.verified && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api("/auth/resend", {});
                            setNotice(
                              "Verification email requested. Check your inbox.",
                            );
                          })
                        }
                      >
                        Verify your email before checkout
                      </button>
                    )}
                  </section>
                </section>
                <aside className="fc-summary">
                  <h2>Your order.</h2>
                  {lines.map((p) => (
                    <div key={p.id}>
                      <span>
                        {cart.lines[p.id]} × {p.name}
                      </span>
                      <strong>{money(p.price_minor * cart.lines[p.id])}</strong>
                    </div>
                  ))}
                  <div className="fc-total">
                    <span>Total</span>
                    <strong>{money(total)}</strong>
                  </div>
                  <button
                    className="fp-primary"
                    disabled={
                      busy ||
                      !checkoutEnabled ||
                      !user.verified ||
                      user.role === "student" ||
                      !user.school_id ||
                      !lines.length
                    }
                  >
                    {busy ? "Connecting…" : "Continue to secure payment"}
                    <ShieldCheck size={18} />
                  </button>
                  <p>The server confirms pricing and stock before payment.</p>
                </aside>
              </form>
            </>
          ) : loaded ? (
            signIn
          ) : null)}
        {path === "/shop/account" &&
          (user ? (
            <>
              <div className="fc-page-heading">
                <h1>
                  Your little corner
                  <br />
                  of FindBox.
                </h1>
                <p>Your orders and supplied tags, connected to your account.</p>
              </div>
              <section>
                <h2>Your orders.</h2>
                {workspace?.orders.map((o) => (
                  <Link
                    key={o.id}
                    className="fc-order-row"
                    to={base + "/orders/" + o.id}
                  >
                    <div>
                      <span className="fp-kicker">{o.status}</span>
                      <h3>{o.id.slice(0, 8).toUpperCase()}</h3>
                      <p>{new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <strong>{money(o.amount_minor)}</strong>
                    <ArrowUpRight />
                  </Link>
                ))}
                {!workspace?.orders.length && <p>No orders yet.</p>}
              </section>
              <section id="tags">
                <div className="fc-section-heading">
                  <h2>Your supplied tags.</h2>
                  <p>
                    Your tags appear when your order is fulfilled. Use the
                    private activation code inside your pack.
                  </p>
                </div>
                <div className="fc-tag-grid">
                  {workspace?.tags.map((t) => (
                    <article key={t.id}>
                      <span className="fp-kicker">{t.status}</span>
                      <h3>{t.format}</h3>
                      <code>{t.code}</code>
                      {t.status === "active" ? (
                        <Link to="/app/items">View belongings</Link>
                      ) : (
                        <button onClick={() => setCode(t.code)}>
                          Connect a belonging <Plus size={16} />
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : loaded ? (
            signIn
          ) : null)}
        {order && (
          <>
            <Link className="fc-back" to={base + "/account"}>
              <ArrowLeft size={16} />
              My orders
            </Link>
            <div className="fc-page-heading">
              <span className="fp-kicker">
                ORDER {order.id.slice(0, 8).toUpperCase()}
              </span>
              <h1>
                {order.status === "fulfilled"
                  ? "Ready for collection."
                  : order.status === "paid"
                    ? "Payment confirmed."
                    : order.status === "pending"
                      ? "Waiting for payment."
                      : order.status === "expired"
                        ? "Payment window ended."
                        : order.status === "refunded"
                          ? "Payment refunded."
                          : "Order cancelled."}
              </h1>
              <p>
                {order.status === "fulfilled"
                  ? "Collect your pack through your school. Private activation codes are inside."
                  : order.status === "paid"
                    ? "Your tags are being prepared."
                    : "Only verified payment-provider confirmation updates this order."}
              </p>
            </div>
            <div className="fc-checkout-grid">
              <section>
                {order.lines.map((l, i) => (
                  <div className="fc-order-row" key={i}>
                    <strong>{l.name}</strong>
                    <span>{l.quantity} packs</span>
                  </div>
                ))}
                {["pending", "expired"].includes(order.status) && (
                  <button
                    disabled={busy}
                    className="fp-primary"
                    onClick={() =>
                      run(async () => {
                        await api("/orders/" + order.id + "/verify", {});
                        cart.clear();
                        await reload();
                        setNotice("Payment confirmed.");
                      })
                    }
                  >
                    Check payment status
                  </button>
                )}
              </section>
              <aside className="fc-summary">
                <h2>{money(order.amount_minor)}</h2>
                <p>
                  {order.payment_method === "mpesa" ? "M-Pesa" : "Card"} ·{" "}
                  {order.status}
                </p>
                <Link className="fp-primary" to={base + "/account"}>
                  Your orders & tags <ArrowUpRight size={16} />
                </Link>
              </aside>
            </div>
          </>
        )}
        {path === "/shop/help" && (
          <div className="fc-help">
            <h1>A little clarity.</h1>
            <p>
              Tags identify belongings when scanned. Staff confirm their school
              collection location. Orders are collected through your selected
              school.
            </p>
            <p>
              Payments remain unavailable until the merchant account is
              configured. An order is paid only after verification from the
              payment provider.
            </p>
            <Link to="/app/security">
              Privacy, security and account controls
            </Link>
          </div>
        )}
        {loaded &&
          path.startsWith("/shop/orders/") &&
          !order &&
          (user ? (
            <div className="fc-empty">
              <h2>Order unavailable.</h2>
              <p>Sign in with the account that placed this order.</p>
            </div>
          ) : (
            signIn
          ))}
        {code && (
          <div className="fc-modal">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="activate-title"
            >
              <button
                className="fc-modal-close"
                aria-label="Close activation"
                onClick={() => setCode("")}
              >
                ×
              </button>
              <h2 id="activate-title">Make it yours.</h2>
              <form className="fs-form" onSubmit={activate}>
                <label>
                  Private activation code
                  <input
                    name="activationSecret"
                    required
                    maxLength={200}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Belonging name
                  <input name="name" required maxLength={100} />
                </label>
                <label>
                  Category
                  <select name="category">
                    {[
                      "bottle",
                      "clothing",
                      "book",
                      "lunchbox",
                      "keys",
                      "sports",
                      "electronics",
                      "other",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Belongs to
                  <select name="ownerId">
                    <option value={user?.id}>{user?.name}</option>
                    {workspace?.children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={busy}>Connect to the app</button>
              </form>
            </section>
          </div>
        )}
      </main>
      {!inApp && <FooterBlock onInstall={() => nav("/app/sign-in")} />}
      {inApp && <AppShopNav unread={workspace?.notifications.filter(n=>!n.read_at).length}/>}
    </div>
  );
}
