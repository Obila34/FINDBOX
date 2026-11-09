import { useLocation } from "react-router-dom";
import { SiteNav, SITE_LINKS } from "./SiteNav";
import { isInstalledApp } from "@/lib/standalone";

/** Shop and schools pages use the same navigation bar as the rest of the site. */
export function MarketHeader({ user }: { user?: { name: string; role: string } | null }) {
  const inApp = useLocation().pathname.startsWith("/app/shop");
  if (inApp && isInstalledApp()) return null;
  if (inApp) return <SiteNav user={user ?? { name: "Your FindBox", role: "parent" }} cart />;
  return <SiteNav user={user} links={SITE_LINKS} homeTo="/" cart />;
}
