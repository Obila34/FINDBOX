import { NavLink } from "react-router-dom";
import {
  Home,
  Boxes,
  ShoppingBag,
  PackageCheck,
  UserRound,
} from "lucide-react";
export function AppShopNav() {
  return (
    <div className="fb-unified-app">
      <nav className="fb-bottom-nav fb-safe-b" aria-label="App shop navigation">
        {[
          ["/app/home", "Home", Home],
          ["/app/items", "Items", Boxes],
          ["/app/shop", "Shop", ShoppingBag],
          ["/app/shop/account", "Orders and tags", PackageCheck],
          ["/app/account", "Account", UserRound],
        ].map(([to, label, Icon]) => {
          const I = Icon as typeof Home;
          return (
            <NavLink
              key={String(to)}
              to={String(to)}
              end
              className={({ isActive }) =>
                "fb-workspace-mobile-link " + (isActive ? "is-active" : "")
              }
            >
              <span className="fb-dock-icon">
                <I size={21} strokeWidth={1.35} />
              </span>
              <span className="sr-only">{String(label)}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
