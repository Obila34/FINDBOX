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
export function ServerAuth() {
  const location = useLocation(),
    nav = useNavigate(),
    path = location.pathname;
  const [google, setGoogle] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [challenge, setChallenge] = useState(false);
  const signup = path.endsWith("sign-up"),
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
      typeof from === "string" && /^\/(app|shop|refer)(\/|$)/.test(from)
        ? from
        : ["staff", "manager"].includes(r.user.role)
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
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (challenge) {
        enter(
          await api<AuthResult>("/account/mfa/challenge", { code: d.code }),
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
        await api<AuthResult>("/auth/" + (signup ? "signup" : "login"), {
          ...d,
          role: "parent",
        }),
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
      lede="One secure account for your app, tags and orders."
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
                <label>
                  School invitation code
                  <input name="schoolCode" required maxLength={100} />
                </label>
                <p>
                  Creates a parent account. Students and staff use their school
                  or guardian’s invitation process.
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
      {!challenge && !forgot && !reset && !verify && (
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
          <Link className="fb-link" to="/app/forgot">
            Forgot password?
          </Link>
        </>
      )}
      {!reset && !verify && !forgot && <Link className="fb-link" to={signup?"/app/sign-in":"/app/sign-up"} state={location.state}>{signup?"Already a member? Sign in":"Join FindBox · Create an account"}</Link>}
      {(reset || verify || forgot) && (
        <Link to="/app/sign-in" className="fb-link">
          Back to sign in
        </Link>
      )}
    </AuthFrame>
  );
}
