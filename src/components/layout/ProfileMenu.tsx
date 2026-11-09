import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { ProfileAvatar, useProfile } from "@/platform/profile";
import { ThemeChoice } from "@/components/ui/ThemeToggle";
import { Sheet } from "@/components/ui/Sheet";
import "./app-navigation.css";
export function ProfileMenu({ name = "Your FindBox", role = "parent" }: { name?: string; role?: string }) {
  const staff = role === "staff" || role === "manager";
  const [open, setOpen] = useState(false);
  const profile = useProfile();
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
        <ProfileAvatar profile={profile} name={name} size={30} ring={false} />
        <ChevronDown size={14} />
      </button>
      <Sheet
        open={open}
        onClose={close}
        title={name}
        description="Your profile, preferences and a little help."
      >
        <Link to="/app/account" onClick={close} className="fb-profile-hero"><ProfileAvatar profile={profile} name={name} size={56} /><span><strong>{profile?.name || name}</strong><small>{profile?.tagline || "Personalise your profile"}</small></span><ArrowUpRight size={18} /></Link>
        <ThemeChoice />
        <nav className="fb-profile-menu" aria-label="Profile menu">
          {[
            ...(role === "manager" ? [["/app/school-admin", "School workspace", "Students, teachers, setup and parent links"]] : []),
            ...(role === "parent" ? [["/app/children", "Your children", "Add a child and manage their logins"]] : []),
            [
              "/app/account",
              "Profile & settings",
              "Your details and daily streak",
            ],
            ["/app/security", "Security & devices", "Passkeys, two-step login and signed-in devices"],
            ...(staff ? [] : [
              [
                "/app/shop/account",
                "Orders & tags",
                "Purchases and supplied tags",
              ],
              ["/app/transfers", "Ownership transfers", "Approve an item changing hands"],
            ]),
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
