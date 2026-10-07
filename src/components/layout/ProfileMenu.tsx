import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { UserRound, ChevronDown, ArrowUpRight } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import "./app-navigation.css";
export function ProfileMenu({ name = "Your FindBox" }: { name?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        className="fb-profile-toggle"
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <UserRound size={20} />
        <ChevronDown size={14} />
      </button>
      <Sheet
        open={open}
        onClose={close}
        title={name}
        description="Your profile, preferences and a little help."
      >
        <nav className="fb-profile-menu" aria-label="Profile menu">
          {[
            [
              "/app/account",
              "Profile & settings",
              "Your details and daily streak",
            ],
            [
              "/app/shop/account",
              "Orders & tags",
              "Purchases and supplied tags",
            ],
            ["/app/help", "Help & support", "Questions, problems and feedback"],
            ["/app/refer", "Refer FindBox", "Share with family or your school"],
          ].map(([to, title, description]) => (
            <Link to={to} key={to} onClick={close}>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </nav>
      </Sheet>
    </>
  );
}
