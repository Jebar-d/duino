import { LogOut } from "lucide-react";
import type { User, Tab } from "./types";
import { tabs } from "./navigation";
import { Button } from "@/components/ui/8bit/button";

interface AdminSidebarProps {
  user: User;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onSignOut: () => void;
}

export function AdminSidebar({
  user,
  tab,
  onTabChange,
  onSignOut,
}: AdminSidebarProps) {
  return (
    <aside className="adm-sidebar">
      <div className="adm-logo">
        <img src="/logo2.png" alt="ARduino Store" />
        <span className="adm-logo-text">Admin Panel</span>
      </div>

      <nav className="adm-nav" aria-label="Admin navigation">
        {tabs.map((item) => (
          <div key={item.id}>
            {item.section && (
              <div className="adm-nav-section">{item.section}</div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`adm-nav-link ${tab === item.id ? "active" : ""}`}
              onClick={() => onTabChange(item.id)}
            >
              <span><item.icon size={18} aria-hidden="true" /></span>
              <span>{item.label}</span>
            </Button>
          </div>
        ))}
      </nav>

      <div className="adm-sidebar-footer">
        <div className="mb-1 text-xs text-muted-foreground">Signed in as</div>

        <div className="break-all text-sm font-semibold text-foreground">
          {user.email || user.username || "Admin"}
        </div>

        <Button
          onClick={onSignOut}
          variant="outline"
          size="sm"
          className="adm-sidebar-signout w-full"
        >
          <LogOut size={16} aria-hidden="true" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
