import { ProfileMenu } from "./ProfileMenu";
import { useServerCart } from "@/commerce/serverCart";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, ShoppingBag, ArrowUpRight } from "lucide-react";
import { StudioBrand } from "@/components/brand/StudioBrand";
import { Sheet } from "@/components/ui/Sheet";
import { useCommerce } from "@/commerce/store";
import { useSession } from "@/store/useStore";
export function MarketHeader() {
  const [open, setOpen] = useState(false);
  const session = useSession();
  const inApp = useLocation().pathname.startsWith("/app/shop");
  const shop = inApp ? "/app/shop" : "/shop";
  const previewCart = useCommerce((s) => s.cart);
  const serverCart = useServerCart((s) => s.lines);
  const cart =
    import.meta.env.VITE_SERVER_MODE === "true" ? serverCart : previewCart;
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  if (inApp)
    return (
      <header className="fb-shop-app-header">
        <StudioBrand to="/app/home" />
        <div>
          <Link to={shop + "/cart"} aria-label={`Shopping bag, ${count} items`}>
            <ShoppingBag size={21} />
            {count > 0 && <small>{count}</small>}
          </Link>
          <ProfileMenu />
        </div>
      </header>
    );
  return (
    <header className="fb-site-header">
      <div className="fb-pill-nav">
        <StudioBrand />
        <nav aria-label="Site" className="hidden items-center gap-7 md:flex">
          <Link to={shop + "/catalog"}>Shop labels</Link>
          <a href="/#how">How it works</a>
          <a href="/#your-app">The app</a>
          <Link to={shop + "/account"}>My tags & orders</Link>
        </nav>
        <div className="fc-header-actions">
          <Link to={shop + "/cart"} aria-label={`Shopping bag, ${count} items`}>
            <ShoppingBag size={19} />
            {count > 0 && <span>{count}</span>}
          </Link>
          <Link className="fc-header-refer hidden lg:flex" to="/refer">Refer your school</Link>
          <Link className="fc-header-signin" to={session ? "/app/home" : "/app/sign-in"} data-auth-bypass={!session ? "" : undefined}>
            {session ? (inApp ? "Back to app" : "Open app") : "Log in"} <ArrowUpRight size={16} />
          </Link>
          <button
            className="fb-menu-toggle md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Explore FindBox">
        <nav className="fb-mobile-site-nav">
          {[
            ["/", "FindBox home"],
            ["/shop", "The store"],
            ["/shop/catalog", "All tag packs"],
            ["/shop/account", "My tags & orders"],
            ["/shop/help", "Help & delivery"],
            ["/refer", "Refer your school"],
          ].map(([url, title]) => (
            <Link
              to={inApp && url.startsWith("/shop") ? "/app" + url : url}
              key={url}
              onClick={() => setOpen(false)}
            >
              {title}
              <ArrowUpRight size={18} />
            </Link>
          ))}
          <Link data-auth-bypass={!session ? "" : undefined} to={session ? "/app/home" : "/app/sign-in"} onClick={() => setOpen(false)}>{session ? "Open the app" : "Log in"}<ArrowUpRight size={18} /></Link>
        </nav>
      </Sheet>
    </header>
  );
}
