import { BarChart3, KeyRound, LayoutDashboard, Mail, Package, RotateCcw, TicketPercent, Truck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tab } from "./types";

export const tabs: {
  id: Tab;
  label: string;
  icon: LucideIcon;
  section?: string;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "inventory", label: "Inventory", icon: Package, section: "Catalog" },
  { id: "promos", label: "Promos", icon: TicketPercent },
  { id: "orders", label: "Orders", icon: Truck, section: "Manage" },
  { id: "users", label: "Users", icon: Users },
  { id: "messages", label: "Messages", icon: Mail },
  { id: "refunds", label: "Refunds", icon: RotateCcw },
  { id: "admins", label: "Admin Users", icon: KeyRound },
];
