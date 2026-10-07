import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  MessageCircle,
  Share2,
  LifeBuoy,
  CheckCircle2,
} from "lucide-react";
import { api, ApiError, type User } from "@/platform/api";
import { StudioBrand } from "@/components/brand/StudioBrand";
import { usePerson } from "@/store/useStore";
import "./support.css";
const connected = import.meta.env.VITE_SERVER_MODE === "true";
type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  kind: string;
  context: string;
  email?: string;
  assigned_to?: string | null;
};
type Detail = {
  ticket: Ticket;
  replies: { id: string; message: string; created_at: string }[];
};
export function Support() {
  const location = useLocation(),
    sample = usePerson();
  const referral = location.pathname.includes("refer"),
    inbox = location.pathname === "/manage/support";
  const [user, setUser] = useState<User | null>(null),
    [operator, setOperator] = useState(false),
    [ready, setReady] = useState(!connected);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState("new"),
    [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [code, setCode] = useState(""),
    [count, setCount] = useState(0),
    [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState(
    location.pathname.includes("feedback")
      ? "feedback"
      : ["school", "feedback"].includes(
            new URLSearchParams(location.search).get("kind") || "",
          )
        ? new URLSearchParams(location.search).get("kind")!
        : "general",
  );
  const inApp = location.pathname.startsWith("/app") || inbox,
    base = inApp ? "/app/help" : "/contact";
  const person = connected ? user : sample;
  const ref = new URLSearchParams(location.search).get("ref") || "";
  const shareUrl =
    window.location.origin +
    "/contact?kind=school" +
    (code ? "&ref=" + code : "");
  useEffect(() => {
    setKind(
      location.pathname.includes("feedback")
        ? "feedback"
        : ["school", "feedback"].includes(
              new URLSearchParams(location.search).get("kind") || "",
            )
          ? new URLSearchParams(location.search).get("kind")!
          : "general",
    );
    setNotice("");
    setError("");
    setDetail(null);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    api<{ user: User }>("/auth/me")
      .then(async (r) => {
        if (!alive) return;
        setUser(r.user);
        const a = await api<{ operator: boolean }>("/support/access");
        if (alive) setOperator(a.operator);
      })
      .catch((e) => {
        if (alive && (!(e instanceof ApiError) || e.status !== 401))
          setError(e.message);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function load() {
    if (!connected || !user) return;
    if (inbox) {
      const r = await api<{
        tickets: Ticket[];
        operators: { id: string; name: string }[];
      }>("/support/inbox?status=" + filter);
      setTickets(r.tickets);
      setOperators(r.operators);
    } else
      setTickets(
        (await api<{ tickets: Ticket[] }>("/support/tickets")).tickets,
      );
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [user, filter, inbox]);
  useEffect(() => {
    if (
      !connected ||
      !user ||
      !referral ||
      user.role === "student" ||
      !user.verified
    )
      return;
    api<{ code: string; schoolEnquiries: number }>("/referrals")
      .then((r) => {
        setCode(r.code);
        setCount(r.schoolEnquiries);
      })
      .catch((e) => setError(e.message));
  }, [user, referral]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (!connected) {
      setNotice(
        "Your message is ready, but has not been sent. Support submissions will open when the FindBox server is connected.",
      );
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/support/tickets", {
        ...data,
        kind,
        requestKey,
        ...(/^[a-f0-9]{24}$/.test(ref) ? { referralCode: ref } : {}),
      });
      setNotice(
        "Request received. Your reference is " +
          r.id +
          "." +
          (user?.verified
            ? " An acknowledgement has been queued for email."
            : " Please keep this reference; our team can reply to the email you provided."),
      );
      setRequestKey(crypto.randomUUID());
      form.reset();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    setError("");
    try {
      setDetail(await api<Detail>("/support/tickets/" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!detail) return;
    const d = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      await api("/support/tickets/" + detail.ticket.id + "/update", {
        ...d,
        assignedTo: d.assignedTo || null,
      });
      setNotice("Request updated. Any reply has been queued for email.");
      setDetail(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: "Introduce your school to FindBox",
          text: "A little less lost. Discover FindBox for your school.",
          url: shareUrl,
        });
      else {
        await navigator.clipboard.writeText(shareUrl);
        setNotice("Link copied.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError("Sharing is unavailable. Copy the link below.");
    }
  }
  return (
    <div className="fb-support">
      <header>
        <StudioBrand />
        <Link to={inApp ? "/app/account" : "/"}>
          {inApp ? "Back to account" : "Back to FindBox"}{" "}
          <ArrowUpRight size={16} />
        </Link>
      </header>
      <main>
        <span className="fb-kicker">YOUR PEOPLE. HERE TO HELP.</span>
        <h1>
          {inbox
            ? "The support desk."
            : referral
              ? "Good things are\nbetter shared."
              : "A little help.\nA real conversation."}
        </h1>
        <p className="support-lede">
          {referral
            ? "Introduce FindBox to another family or your school community."
            : inbox
              ? "Follow up, reply and keep every request moving."
              : "Questions, ideas or something that needs fixing? You are in the right place."}
        </p>
        <nav className="support-tabs" aria-label="Support">
          <Link to={base}>
            <LifeBuoy size={17} />
            Contact us
          </Link>
          <Link to={inApp ? "/app/feedback" : "/contact?kind=feedback"}>
            <MessageCircle size={17} />
            Feedback
          </Link>
          <Link to={inApp ? "/app/refer" : "/refer"}>
            <Share2 size={17} />
            Refer FindBox
          </Link>
          {operator && <Link to="/manage/support">Support inbox</Link>}
        </nav>
        {error && (
          <p role="alert" className="support-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="support-notice">
            {notice}
          </p>
        )}
        {!ready ? (
          <p role="status">Loading your account…</p>
        ) : referral ? (
          <section className="support-share">
            <div>
              <Share2 size={38} />
              <h2>Share a little peace of mind.</h2>
              <p>
                Send an introduction using your phone’s share menu, WhatsApp or
                a copied link. The link contains no names, school details or
                private belongings.
              </p>
              <button onClick={share}>
                Share FindBox <ArrowUpRight size={18} />
              </button>
              <a
                className="support-whatsapp"
                href={
                  "https://wa.me/?text=" +
                  encodeURIComponent(
                    "Discover FindBox for your school: " + shareUrl,
                  )
                }
                target="_blank"
                rel="noreferrer"
              >
                Share on WhatsApp
              </a>
              <label>
                Your share link
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              {code && (
                <p>
                  {count} school {count === 1 ? "enquiry" : "enquiries"}{" "}
                  received through your link.
                </p>
              )}
              <p className="support-small">
                Sharing is voluntary. There are no referral rewards or discounts
                at this stage. Personal referral links are available to verified
                adult accounts; everyone can share the public link.
              </p>
            </div>
            <img
              src="/media/avatars/findbox-explorer-640.webp"
              alt="The FindBox explorer"
            />
          </section>
        ) : inbox ? (
          <section>
            <h2>Requests</h2>
            {!operator ? (
              <p>
                Sign in with an authorised support operator account to access
                this inbox.
              </p>
            ) : (
              <label>
                Queue
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="new">New</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
            )}
          </section>
        ) : (
          <div className="support-grid">
            <form onSubmit={submit}>
              <h2>
                {kind === "feedback" || kind === "suggestion" || kind === "bug"
                  ? "Help us make FindBox better."
                  : "How can we help?"}
              </h2>
              <div className="support-fields">
                <label>
                  Your name
                  <input
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={person?.name || ""}
                    autoComplete="name"
                  />
                </label>
                <label>
                  Email for replies
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    defaultValue={user?.email || ""}
                    readOnly={!!user}
                    autoComplete="email"
                  />
                </label>
              </div>
              <label>
                What is this about?
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {[
                    ["general", "General question"],
                    ["school", "Introduce a school"],
                    ["order", "Order or tag help"],
                    ["bug", "Report a problem"],
                    ["suggestion", "Suggest an improvement"],
                    ["feedback", "Share feedback"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Subject
                <input name="subject" required maxLength={140} />
              </label>
              <label>
                Order or item reference <small>(optional)</small>
                <input name="context" maxLength={120} />
              </label>
              <label>
                Your message
                <textarea name="message" rows={5} required maxLength={4000} />
              </label>
              <div className="support-honey" aria-hidden="true">
                <input
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-label="Leave empty"
                />
              </div>
              <p className="support-small">
                Please do not include passwords, payment PINs or private details
                about children. School collection enquiries can also be directed
                to your school office.
              </p>
              <label className="support-consent">
                <input type="checkbox" required />I agree that FindBox may use
                these details to respond to my request.
              </label>
              <button disabled={busy}>
                {busy
                  ? "Sending…"
                  : connected
                    ? "Send request"
                    : "Check request"}{" "}
                <ArrowUpRight size={18} />
              </button>
              {!connected && (
                <p className="support-small">
                  The server is not connected in this preview. Messages are not
                  sent or saved.
                </p>
              )}
            </form>
            <aside>
              <img
                src="/media/objects/bottle-640.webp"
                alt="A FindBox tagged bottle"
              />
              <h2>A clear next step.</h2>
              <p>
                Keep your request reference so we can follow up. Signed-in users
                can read their replies here.
              </p>
              <Link to="/shop/help">
                Browse common questions <ArrowUpRight size={16} />
              </Link>
              <Link to="/app/inbox">
                Collection notifications <ArrowUpRight size={16} />
              </Link>
            </aside>
          </div>
        )}
        {!referral && connected && user && (!inbox || operator) && (
          <section className="support-history">
            <h2>{inbox ? "Queue" : "Your requests"}</h2>
            <p className="support-small">
              Showing up to 100{" "}
              {inbox ? "oldest requests in this queue" : "most recent requests"}
              .
            </p>
            {tickets.length ? (
              tickets.map((t) => (
                <button
                  className="support-ticket"
                  key={t.id}
                  onClick={() => open(t.id)}
                >
                  <span>
                    {t.subject}
                    <small>{t.id}</small>
                  </span>
                  <span>
                    {t.status.replace("_", " ")} <ArrowUpRight size={15} />
                  </span>
                </button>
              ))
            ) : (
              <p>No requests here yet.</p>
            )}
          </section>
        )}
        {detail && (
          <section className="support-detail">
            <button className="support-close" onClick={() => setDetail(null)}>
              Close request
            </button>
            <h2>{detail.ticket.subject}</h2>
            <p>
              {detail.ticket.id} · {detail.ticket.status.replace("_", " ")}
            </p>
            {inbox && operator && (
              <p>
                {detail.ticket.email} · {detail.ticket.kind}
              </p>
            )}
            <p className="support-message">{detail.ticket.message}</p>
            {detail.ticket.context && <p>Reference: {detail.ticket.context}</p>}
            {detail.replies.map((r) => (
              <blockquote key={r.id}>
                <CheckCircle2 size={18} />
                <p className="support-message">{r.message}</p>
                <small>{new Date(r.created_at).toLocaleString()}</small>
              </blockquote>
            ))}
            {inbox && operator && (
              <form key={detail.ticket.id} onSubmit={update}>
                <label>
                  Status
                  <select name="status" defaultValue={detail.ticket.status}>
                    <option value="new">New</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
                <label>
                  Assigned to
                  <select
                    name="assignedTo"
                    defaultValue={detail.ticket.assigned_to || ""}
                  >
                    <option value="">Unassigned</option>
                    {operators.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reply to requester
                  <textarea name="reply" rows={4} maxLength={4000} />
                </label>
                <button disabled={busy}>Save update</button>
              </form>
            )}
          </section>
        )}
      </main>
      <footer>
        <StudioBrand />
        <p>A little less lost. A little more connected.</p>
        <Link to="/shop">Explore the tag store</Link>
      </footer>
    </div>
  );
}
