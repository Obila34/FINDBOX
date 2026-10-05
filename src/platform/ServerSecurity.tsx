import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Download, KeyRound, LogOut } from "lucide-react";
import { AuthFrame } from "@/pages/auth/AuthFrame";
import { api, ApiError } from "./api";
import "./account.css";
type Security = {
  mfaEnabled: boolean;
  mfaRequired: boolean;
  mfaVerified: boolean;
  googleLinked: boolean;
  googleAvailable: boolean;
  sessions: { createdAt: string; expiresAt: string; current: boolean }[];
};
export function ServerSecurity() {
  const nav = useNavigate();
  const [data, setData] = useState<Security | null>(null),
    [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null),
    [codes, setCodes] = useState<string[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [schools, setSchools] = useState<
      { id: string; name: string; role: string }[]
    >([]),
    [active, setActive] = useState("");
  async function load() {
    const r = await api<Security>("/account/security");
    setData(r);
    if (!r.mfaRequired || r.mfaVerified) {
      const s = await api<{ schools: typeof schools; activeSchoolId: string }>(
        "/account/schools",
      );
      setSchools(s.schools);
      setActive(s.activeSchoolId);
    }
  }
  useEffect(() => {
    load().catch((e) => {
      if (e instanceof ApiError && e.status === 401) nav("/app/sign-in");
      else setError(e.message);
    });
  }, []);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code"));
    void action(async () => {
      const r = await api<{ recoveryCodes: string[] }>("/account/mfa/confirm", {
        code,
      });
      setCodes(r.recoveryCodes);
      setSetup(null);
      setMessage(
        "Two-factor authentication is enabled. Save your recovery codes securely; each works once.",
      );
    });
  }
  const limited = data?.mfaRequired && !data.mfaVerified;
  return (
    <AuthFrame
      title="Your account. Your control."
      lede="Protect access, manage schools and control your information."
      width="md"
      back={{ to: "/app/home", label: "Back to your app" }}
    >
      <div className="fs-security">
        {error && (
          <p role="alert" className="fb-auth-status">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="fb-auth-status">
            {message}
          </p>
        )}
        <section>
          <ShieldCheck />
          <h2>Two-factor authentication</h2>
          <p>
            {data?.mfaEnabled
              ? "An authenticator protects your account."
              : "Add a second layer of protection. Required for school staff and administrators in production."}
          </p>
          {!data?.mfaEnabled && !setup && (
            <button
              disabled={busy || !data}
              onClick={() =>
                action(async () =>
                  setSetup(await api("/account/mfa/setup", {})),
                )
              }
            >
              Set up authenticator
            </button>
          )}
          {setup && (
            <>
              <p>
                Enter this setup key in your authenticator app, then enter its
                six-digit code.
              </p>
              <code className="fs-secret">{setup.secret}</code>
              <form className="fs-form" onSubmit={confirm}>
                <label>
                  Authenticator code
                  <input
                    name="code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    required
                  />
                </label>
                <button disabled={busy}>Confirm setup</button>
              </form>
            </>
          )}
          {codes.length > 0 && (
            <div>
              <h3>Save your recovery codes</h3>
              <p>They are shown once. Store them outside this device.</p>
              <pre className="fs-secret">{codes.join("\n")}</pre>
              <button onClick={() => setCodes([])}>
                I have saved my codes
              </button>
            </div>
          )}
          {limited && data?.mfaEnabled && (
            <Link to="/app/sign-in">
              Sign in to complete the authenticator check
            </Link>
          )}
        </section>
        {!limited && data && (
          <>
            <section>
              <KeyRound />
              <h2>Sign-in connections</h2>
              <p>
                {data.googleLinked
                  ? "Your Google account is linked."
                  : "Link the Google account matching your email after signing in."}
              </p>
              {!data.googleLinked && data.googleAvailable && (
                <a href="/api/auth/google/start?link=1">Link Google account</a>
              )}
              <h3>Active sessions</h3>
              {data.sessions.map((s, i) => (
                <p key={i}>
                  {s.current ? "This session" : "Another session"} ·{" "}
                  {new Date(s.createdAt).toLocaleDateString()}
                </p>
              ))}
              <button
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    await api("/account/sessions/revoke", {});
                    setMessage("Other sessions have been signed out.");
                  })
                }
              >
                Sign out other sessions
              </button>
            </section>
            <section>
              <h2>Your schools</h2>
              {schools.map((s) => (
                <button
                  key={s.id}
                  disabled={busy || s.id === active}
                  onClick={() =>
                    action(async () => {
                      await api("/account/schools/select", { schoolId: s.id });
                      setMessage(
                        "School changed. Open the app to view this workspace.",
                      );
                    })
                  }
                >
                  {s.name} · {s.role}
                  {s.id === active ? " · Active" : ""}
                </button>
              ))}
              <form
                className="fs-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const schoolCode = String(
                    new FormData(e.currentTarget).get("schoolCode"),
                  );
                  void action(async () => {
                    await api("/account/schools/join", { schoolCode });
                    setMessage("School joined. Select it above to continue.");
                  });
                }}
              >
                <label>
                  School invitation code
                  <input name="schoolCode" required maxLength={100} />
                </label>
                <button disabled={busy}>Join a school</button>
              </form>
            </section>
            <section>
              <Download />
              <h2>Your information</h2>
              <p>
                Export your account, belongings and orders. Deletion requests
                require review where financial or safeguarding records must be
                retained.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const result = await api("/account/export");
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(result, null, 2)], {
                        type: "application/json",
                      }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "findbox-personal-data.json";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    setMessage("Your export has been downloaded.");
                  })
                }
              >
                Download my data
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    await api("/account/privacy-request", { kind: "deletion" });
                    setMessage(
                      "Deletion request recorded for review. Your account has not been deleted.",
                    );
                  })
                }
              >
                Request account deletion
              </button>
            </section>
          </>
        )}
        <button
          className="fs-google"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await api("/auth/logout", {});
              nav("/app/sign-in");
            })
          }
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </AuthFrame>
  );
}
