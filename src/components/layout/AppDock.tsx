import { usePerson,useUnread } from '@/store/useStore';
import { NavLink } from "react-router-dom";
import { House, Boxes, Inbox, ShoppingBag } from "lucide-react";
import "./app-navigation.css";
export function AppDock({ unread: supplied }: { unread?: number }) {
 const person=usePerson();const localUnread=useUnread(person?.id);const unread=supplied??(import.meta.env.VITE_SERVER_MODE==='true'?0:localUnread);
  return (
    <nav className="fb-simple-dock" aria-label="Mobile primary">
      {[
        ["/app/home", "Home", House],
        ["/app/items", "Items", Boxes],
        ["/app/inbox", "Inbox", Inbox],
        ["/app/shop", "Shop", ShoppingBag],
      ].map(([to, label, Icon]) => {
        const I = Icon as typeof House;
        return (
          <NavLink
            key={String(to)}
            to={String(to)}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <span>
              <I size={21} strokeWidth={1.65} />
              {label === "Inbox" && unread > 0 && (
                <i aria-label={`${unread} unread messages`}>
                  {unread > 9 ? "9+" : unread}
                </i>
              )}
            </span>
            <small>{String(label)}</small>
          </NavLink>
        );
      })}
    </nav>
  );
}
