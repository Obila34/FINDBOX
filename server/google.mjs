import { createRemoteJWKSet, jwtVerify } from "jose";
import { requireThat } from "./security.mjs";
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export function googleProvider(config) {
  return {
    async exchange(code, state) {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.googleClientId,
          client_secret: config.googleClientSecret,
          redirect_uri: config.origin + "/api/auth/google/callback",
          grant_type: "authorization_code",
          code_verifier: state.verifier,
        }),
        signal: AbortSignal.timeout(12000),
      });
      requireThat(response.ok, 401, "Google sign-in could not be verified");
      const data = await response.json();
      const { payload } = await jwtVerify(data.id_token, jwks, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: config.googleClientId,
        algorithms: ["RS256"],
        maxTokenAge: "10m",
      });
      requireThat(
        payload.nonce === state.nonce &&
          payload.email_verified === true &&
          typeof payload.email === "string" &&
          typeof payload.sub === "string",
        401,
        "Google sign-in could not be verified",
      );
      return {
        subject: payload.sub,
        email: payload.email.toLowerCase(),
        name: String(payload.name || "FindBox member").slice(0, 100),
      };
    },
  };
}
