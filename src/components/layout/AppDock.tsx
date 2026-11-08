import { usePerson,useUnread } from '@/store/useStore';
import { NavLink } from "react-router-dom";
import { House, Boxes, Inbox, ShoppingBag, ScanLine, Flame } from "lucide-react";
import "./app-navigation.css";
export function AppDock({ unread: supplied, role = "parent" }: { unread?: number; role?: string }) {
 const person=usePerson();const localUnread=useUnread(person?.id);const unread=supplied??(import.meta.env.VITE_SERVER_MODE==='true'?0:localUnread);
  return (
    <nav className="fb-simple-dock" aria-label="Mobile primary">
      {(role === "student"
        ? [["/app/home", "Home", House], ["/app/items", "My items", Boxes], ["/app/found", "Found", ScanLine], ["/app/streaks", "Streaks", Flame], ["/app/inbox", "Inbox", Inbox]]
        : [["/app/home", "Home", House], ["/app/items", "Items", Boxes], ["/app/register", "Activate", ScanLine], ["/app/shop", "Shop", ShoppingBag], ["/app/inbox", "Inbox", Inbox]]
      ).map(([to, label, Icon]) => {
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
