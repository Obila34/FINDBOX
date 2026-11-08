import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthFrame } from "@/pages/auth/AuthFrame";
import { api, type User } from "./api";
import "./account.css";
type AuthResult = {
  user: User;
  requiresMfa?: boolean;
  mfaSetupRequired?: boolean;
  security?: { requiresMfa: boolean; mfaSetupRequired: boolean };
};
export function ServerAuth({ portal = "family" }: { portal?: "family" | "school" }) {
  const school = portal === "school";
  const location = useLocation(),
    nav = useNavigate(),
    path = location.pathname;
  const [google, setGoogle] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [challenge, setChallenge] = useState(false),
    [joining, setJoining] = useState<{ code: string; name: string } | null>(null);
  const linkCode = new URLSearchParams(location.search).get("school") || "";
  const signup = !school && path.endsWith("sign-up"),
    forgot = path.endsWith("forgot"),
    reset = path.endsWith("reset"),
    verify = path.endsWith("verify");
  function enter(r: AuthResult) {
    const security = r.security || r;
    if (security.mfaSetupRequired) {
      nav("/app/security", { replace: true });
      return;
    }
    if (security.requiresMfa) {
      setChallenge(true);
      return;
    }
    const from = location.state?.from;
    nav(
      typeof from === "string" && !school && /^\/(app|shop|refer)(\/|$)/.test(from)
        ? from
        : r.user.role === "manager"
          ? "/app/school-admin"
          : r.user.role === "staff"
            ? "/manage"
            : "/app/home",
      { replace: true },
    );
  }
  useEffect(() => {
    api<{ google: boolean }>("/auth/options")
      .then((r) => setGoogle(r.google))
      .catch(() =>
        setError("The account server is unavailable. Please try again."),
      );
    if (new URLSearchParams(location.search).get("google") === "complete")
      api<AuthResult>("/auth/me")
        .then(enter)
        .catch((e) => setError(e.message));
    if (new URLSearchParams(location.search).get("google") === "failed")
      setError(
        "Google sign-in could not be completed. If you already have an email account, sign in with email first and link Google in Security.",
      );
  }, []);
  useEffect(() => {
    setError("");
    setMessage("");
    setChallenge(false);
  }, [path]);
  // A school's parent link carries its code, so families never have to type one.
  useEffect(() => {
    if (!linkCode) return;
    api<{ name: string }>("/schools/join/" + encodeURIComponent(linkCode))
      .then((r) => setJoining({ code: linkCode, name: r.name }))
      .catch((e) => setError(e.message));
  }, [linkCode]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (challenge) {
        enter(
          await api<AuthResult>("/account/mfa/challenge", { code: d.code, trustDevice: d.trustDevice === "on" }),
        );
        return;
      }
      if (forgot) {
        const r = await api<{ message: string }>("/auth/forgot", d);
        setMessage(r.message);
        return;
      }
      if (reset || verify) {
        const token = new URLSearchParams(location.hash.slice(1)).get("token");
        await api("/auth/" + (reset ? "reset" : "verify"), {
          token,
          password: d.password,
        });
        history.replaceState(null, "", path);
        setMessage(
          reset
            ? "Password changed. You can sign in again."
            : "Email verified. Your account is ready.",
        );
        return;
      }
      enter(
        await api<AuthResult>("/auth/" + (signup ? "signup" : "login"), signup ? { ...d, role: "parent" } : { email: d.email, password: d.password, portal }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title={
        challenge
          ? "One more check."
          : school && !forgot && !reset && !verify
            ? "School portal."
            : signup
            ? "Your world, connected."
            : forgot
              ? "Let’s get you back in."
              : reset
                ? "A fresh start."
                : verify
                  ? "Verify your email."
                  : "Welcome back."
      }
      lede={school ? "For teachers and school administrators. Accounts are created by your school's invitation." : "For parents, guardians and students: your tags, items and orders."}
      back={{ to: "/", label: "Back to FindBox" }}
    >
      <form className="fs-form" onSubmit={submit}>
        {challenge ? (
          <label>
            Authenticator or recovery code
            <input
              name="code"
              autoComplete="one-time-code"
              required
              maxLength={32}
            />
          </label>
        ) : null}
        {challenge ? (
          <label className="fs-trust">
            <input type="checkbox" name="trustDevice" />
            Trust this device for 30 days. Only tick this on your own phone or computer.
          </label>
        ) : (
          <>
            {signup && (
              <>
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                  />
                </label>
                {joining ? (
                  <p className="fs-joining">Joining <strong>{joining.name}</strong><input type="hidden" name="schoolCode" value={joining.code} /></p>
                ) : (
                  <label>
                    School code <span className="fs-optional">Optional</span>
                    <input name="schoolCode" maxLength={100} placeholder="From your school's letter or poster" />
                    <small className="fs-hint">No code? Create your account now and add your school later.</small>
                  </label>
                )}
                <p>
                  Creates a parent account. Students are added by their school
                  or guardian.
                </p>
              </>
            )}
            {!reset && !verify && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {!forgot && !verify && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    signup || reset ? "new-password" : "current-password"
                  }
                  minLength={signup || reset ? 12 : 1}
                  maxLength={128}
                  required
                />
              </label>
            )}
          </>
        )}
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
        <button className="fs-primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : challenge
              ? "Verify and continue"
              : signup
                ? "Create account"
                : forgot
                  ? "Send reset link"
                  : reset
                    ? "Save password"
                    : verify
                      ? "Verify email"
                      : "Sign in"}
        </button>
      </form>
      {!school && !challenge && !forgot && !reset && !verify && google && (
        <>
          <div className="fs-divider">or</div>
          <button
            className="fs-google"
            disabled={!google || busy}
            onClick={() => window.location.assign("/api/auth/google/start")}
          >
            <span aria-hidden="true">G</span>Continue with Google
          </button>
          {!google && (
            <p className="fs-hint">
              Google sign-in will be available once the account connection is
              configured.
            </p>
          )}

        </>
      )}
      {!challenge && !forgot && !reset && !verify && !signup && <Link className="fb-link" to="/app/forgot">Forgot password?</Link>}
      {!school && !reset && !verify && !forgot && <Link className="fb-link" to={signup?"/app/sign-in":"/app/sign-up"} state={location.state}>{signup?"Already a member? Sign in":"Join FindBox · Create an account"}</Link>}
      {!challenge && !reset && !verify && !forgot && (school
        ? <p className="fs-portal-switch">Parent or student? <Link to="/app/sign-in">Use the family sign-in</Link></p>
        : <p className="fs-portal-switch">Teacher or school administrator? <Link to="/school/sign-in">Sign in to the school portal</Link></p>)}
      {(reset || verify || forgot) && (
        <Link to="/app/sign-in" className="fb-link">
          Back to sign in
        </Link>
      )}
    </AuthFrame>
  );
}
