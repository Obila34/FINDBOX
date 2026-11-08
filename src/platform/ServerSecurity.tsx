import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Download, KeyRound, LogOut } from "lucide-react";
import { AuthFrame } from "@/pages/auth/AuthFrame";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { api, ApiError } from "./api";
import "./account.css";
type Security = {
  companyAccess?: boolean;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  mfaVerified: boolean;
  googleLinked: boolean;
  googleAvailable: boolean;
  sessions: { id: string; device: string; portal: string; createdAt: string; lastSeenAt: string; expiresAt: string; current: boolean }[];
  trustedDevices: { id: string; label: string; created_at: string; last_used_at: string; expires_at: string }[];
  passkeys: { id: string; label: string; created_at: string; last_used_at: string | null }[];
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
          {data?.companyAccess && <p><Link to="/company">Return to company workspace</Link></p>}
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
              <h3>Passkeys</h3>
              <p>Sign in with your fingerprint, face or phone screen lock. Nothing to remember, and it cannot be phished.</p>
              {data.passkeys?.length > 0 && (
                <ul className="sx-devices">
                  {data.passkeys.map((k) => (
                    <li key={k.id}>
                      <div><strong><Fingerprint size={15} />{k.label || "Passkey"}</strong><small>Added {new Date(k.created_at).toLocaleDateString("en-KE")}{k.last_used_at ? " · last used " + new Date(k.last_used_at).toLocaleDateString("en-KE") : ""}</small></div>
                      <button disabled={busy} onClick={() => action(async () => { await api("/account/passkeys/" + k.id + "/remove", {}); setMessage("Passkey removed."); })}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
              {browserSupportsWebAuthn() ? (
                <button
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      const options = await api<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/account/passkeys/options", {});
                      try {
                        const response = await startRegistration({ optionsJSON: options });
                        await api("/account/passkeys/register", { response });
                        setMessage("Passkey added. Next time, choose Sign in with a passkey.");
                      } catch (e) {
                        if ((e as Error).name !== "NotAllowedError") throw e;
                      }
                    })
                  }
                >
                  Add a passkey
                </button>
              ) : <p>This browser does not support passkeys.</p>}
              <h3>Where you're signed in</h3>
              <ul className="sx-devices">
                {data.sessions.map((s) => (
                  <li key={s.id}>
                    <div>
                      <strong>{s.device}{s.current && <span className="sx-current">This device</span>}</strong>
                      <small>{s.portal === "ops" ? "Operations" : s.portal === "school" ? "School portal" : "Family app"} · last active {new Date(s.lastSeenAt).toLocaleString("en-KE")}</small>
                    </div>
                    {!s.current && (
                      <button disabled={busy} onClick={() => action(async () => { await api("/account/sessions/" + s.id + "/revoke", {}); setMessage(s.device + " has been signed out."); })}>Sign out</button>
                    )}
                  </li>
                ))}
              </ul>
              {data.trustedDevices?.length > 0 && <>
                <h3>Trusted devices</h3>
                <p>These skip the two-step code for 30 days. Your password is still needed.</p>
                <ul className="sx-devices">
                  {data.trustedDevices.map((d) => (
                    <li key={d.id}>
                      <div><strong>{d.label}</strong><small>Trusted until {new Date(d.expires_at).toLocaleDateString("en-KE")}</small></div>
                      <button disabled={busy} onClick={() => action(async () => { await api("/account/devices/" + d.id + "/forget", {}); setMessage(d.label + " is no longer trusted."); })}>Forget</button>
                    </li>
                  ))}
                </ul>
              </>}
              <button
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    await api("/account/sessions/revoke", {});
                    setMessage("Other sessions have been signed out.");
                  })
                }
              >
                Sign out all other devices
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
