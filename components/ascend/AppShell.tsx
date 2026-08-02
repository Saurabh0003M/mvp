"use client";

import { motion } from "framer-motion";
import { Home, Compass, Search, Bell, Sparkles, User } from "lucide-react";

export type Tab = "home" | "explore" | "taste";

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  onProfile: () => void;
  onNotifications: () => void;
  onSearch: () => void;
  notificationsDot?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({
  tab,
  onTab,
  onProfile,
  onNotifications,
  onSearch,
  notificationsDot,
  right,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-sunfade bg-grain">
      <div className="mx-auto grid min-h-screen w-full max-w-[1760px] grid-cols-[72px_minmax(0,1fr)] gap-0 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_340px] 2xl:grid-cols-[240px_minmax(0,1fr)_360px]">
        {/* ── LEFT RAIL — Twitter/Reddit-style persistent nav ─── */}
        <aside className="sticky top-0 flex h-screen flex-col border-r border-border/60 bg-background/60 px-3 py-6 backdrop-blur-xl lg:px-5">
          {/* Brand */}
          <div className="mb-6 flex items-center gap-2.5 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background">
              <span className="text-subtitle font-semibold">A</span>
            </div>
            <span className="hidden text-subtitle font-semibold tracking-tight lg:inline">Ascend</span>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-1" aria-label="Primary">
            <NavItem
              active={tab === "home"}
              onClick={() => onTab("home")}
              icon={<Home className="h-5 w-5" />}
              label="Home"
            />
            <NavItem
              active={tab === "explore"}
              onClick={() => onTab("explore")}
              icon={<Compass className="h-5 w-5" />}
              label="Explore"
            />
            <NavItem
              active={false}
              onClick={onSearch}
              icon={<Search className="h-5 w-5" />}
              label="Search"
            />
            <NavItem
              active={false}
              onClick={onNotifications}
              icon={
                <div className="relative">
                  <Bell className="h-5 w-5" />
                  {notificationsDot && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-foreground" />
                  )}
                </div>
              }
              label="Notifications"
            />
            <NavItem
              active={tab === "taste"}
              onClick={() => onTab("taste")}
              icon={<Sparkles className="h-5 w-5" />}
              label="Taste"
            />
          </nav>

          <div className="flex-1" />

          {/* Profile — pinned at bottom (Instagram pattern) */}
          <NavItem
            active={false}
            onClick={onProfile}
            icon={<User className="h-5 w-5" />}
            label="Profile"
          />
        </aside>

        {/* ── CENTER — the feed ─────────────────────────────── */}
        <main className="min-w-0 border-r border-border/60 xl:border-r">{children}</main>

        {/* ── RIGHT RAIL — Twitter's "What's happening" pattern ─ */}
        <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto px-5 py-6 2xl:px-6 xl:flex">
          {right}
        </aside>
      </div>
    </div>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-4 rounded-full px-3 py-2.5 text-left transition-colors ${
        active
          ? "bg-accent text-foreground"
          : "text-foreground/80 hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      <span className="flex h-6 w-6 items-center justify-center">{icon}</span>
      <span className={`hidden text-body lg:inline ${active ? "font-semibold" : ""}`}>{label}</span>
      {active && (
        <motion.span
          layoutId="nav-active"
          className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-foreground lg:block"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
    </button>
  );
}
