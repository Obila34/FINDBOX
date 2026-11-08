import {PublicMenu} from './PublicMenu';
import { ProfileMenu } from "./ProfileMenu";
import { useServerCart } from "@/commerce/serverCart";
import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, ArrowUpRight } from "lucide-react";
import { StudioBrand } from "@/components/brand/StudioBrand";
import { useCommerce } from "@/commerce/store";
import { useSession } from "@/store/useStore";
export function MarketHeader() {
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
      <div className="fb-pill-nav pm-centered-nav">
        <StudioBrand />
        <PublicMenu/>
        <div className="fc-header-actions">
          <Link to={shop + "/cart"} aria-label={`Shopping bag, ${count} items`}>
            <ShoppingBag size={19} />
            {count > 0 && <span>{count}</span>}
          </Link>
          
          <Link className="fc-header-signin" to={session ? "/app/home" : "/app/sign-in"} data-auth-bypass={!session ? "" : undefined}>
            {session ? (inApp ? "Back to app" : "Open app") : "Log in"} <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

    </header>
  );
}
