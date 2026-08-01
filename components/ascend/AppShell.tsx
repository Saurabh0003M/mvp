"use client";

import { motion } from "framer-motion";
import { User, Bell, Search, Home, Compass, Sparkles } from "lucide-react";

export type Tab = "home" | "explore" | "taste";

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  onProfile: () => void;
  onNotifications: () => void;
  onSearch: () => void;
  notificationsDot?: boolean;
  children: React.ReactNode;
}

export function AppShell({
  tab,
  onTab,
  onProfile,
  onNotifications,
  onSearch,
  notificationsDot,
  children,
}: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-sunfade bg-grain">
      {/* ── Top bar — profile-left, bell, wide gap, search-right ─── */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <IconBtn onClick={onProfile} label="Open profile">
              <User className="h-5 w-5" />
            </IconBtn>
            <IconBtn onClick={onNotifications} label="Notifications">
              <div className="relative">
                <Bell className="h-5 w-5" />
                {notificationsDot && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-foreground" />
                )}
              </div>
            </IconBtn>
          </div>

          <IconBtn onClick={onSearch} label="Search">
            <Search className="h-5 w-5" />
          </IconBtn>
        </div>
      </header>

      {/* Content — leave space for the bottom bar */}
      <main className="flex-1 pb-24">{children}</main>

      {/* ── Bottom tab bar — home / explore / taste ─────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur-xl"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2 sm:px-6">
          <TabBtn active={tab === "home"} onClick={() => onTab("home")} label="Home">
            <Home className="h-5 w-5" />
          </TabBtn>
          <TabBtn active={tab === "explore"} onClick={() => onTab("explore")} label="Explore">
            <Compass className="h-5 w-5" />
          </TabBtn>
          <TabBtn active={tab === "taste"} onClick={() => onTab("taste")} label="Taste">
            <Sparkles className="h-5 w-5" />
          </TabBtn>
        </div>
      </nav>
    </div>
  );
}

function IconBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-foreground/70 transition-colors hover:text-foreground"
    >
      <span className={active ? "text-foreground" : ""}>{children}</span>
      <span className={`text-[10px] leading-none ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
        {label}
      </span>
      {active && (
        <motion.span
          layoutId="tab-underline"
          className="absolute -top-[1px] left-4 right-4 h-0.5 rounded-full bg-foreground"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
    </button>
  );
}
