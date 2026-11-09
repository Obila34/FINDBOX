import { usePerson,useUnread } from '@/store/useStore';
import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { House, Boxes, Inbox, ShoppingBag, ScanLine, Trophy } from "lucide-react";
import "./app-navigation.css";
export function AppDock({ unread: supplied, role = "parent" }: { unread?: number; role?: string }) {
 const person=usePerson();const localUnread=useUnread(person?.id);const unread=supplied??(import.meta.env.VITE_SERVER_MODE==='true'?0:localUnread);
  return (
    <nav className="fb-simple-dock" aria-label="Mobile primary">
      {(role === "student"
        ? [["/app/home", "Home", House], ["/app/items", "My items", Boxes], ["/app/found", "I found it", ScanLine], ["/app/houses", "Houses", Trophy], ["/app/inbox", "Inbox", Inbox]]
        : [["/app/home", "Home", House], ["/app/items", "Items", Boxes], ["/app/found", "I found it", ScanLine], ["/app/shop", "Shop", ShoppingBag], ["/app/inbox", "Inbox", Inbox]]
      ).map(([to, label, Icon]) => {
        const I = Icon as typeof House;
        return (
          <NavLink
            key={String(to)}
            to={String(to)}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.b layoutId="fb-dock-pill" className="fb-dock-pill" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
                <motion.span whileTap={{ scale: 0.82 }} animate={{ y: isActive ? -1 : 0 }}>
                  <I size={21} strokeWidth={isActive ? 2 : 1.65} />
                  {label === "Inbox" && unread > 0 && (
                    <i aria-label={`${unread} unread messages`}>
                      {unread > 9 ? "9+" : unread}
                    </i>
                  )}
                </motion.span>
                <small>{String(label)}</small>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
