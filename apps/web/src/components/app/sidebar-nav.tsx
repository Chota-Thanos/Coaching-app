"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../auth/auth-context";
import { MentorCornerButton } from "./mentor-corner-button";
import {
  PRIMARY_ITEMS,
  NAV_GROUPS,
  SECONDARY_ITEMS,
  SUBSCRIPTION_ITEMS,
  getAdminGroup,
  isNavItemActive,
  type NavItem
} from "../../lib/sidebar-nav-config";

export const SIDEBAR_WIDTH = "w-64";

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] leading-tight transition-colors ${
        active
          ? "bg-civic/10 text-ink font-semibold dark:bg-civic/20"
          : "text-ink/70 font-medium hover:bg-paper hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.9} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function CollapsibleGroup({
  label,
  items,
  pathname,
  search,
  defaultOpen
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  search: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-ink/45 hover:text-ink transition-colors"
      >
        <span>{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {items.map((item) => (
            <NavRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact, search)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarNav({ className = "" }: { className?: string }) {
  const pathname = usePathname() || "/";
  // Self-Preparation pairs each paper's test with its scorecard, and those
  // differ only by query string — without it both rows light up at once.
  const search = useSearchParams()?.toString() ?? "";
  const { user } = useAuth();
  const adminGroup = getAdminGroup(user);

  return (
    <aside
      className={`${SIDEBAR_WIDTH} shrink-0 border-r border-line bg-surface sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto ${className}`}
      aria-label="Sidebar navigation"
    >
      <div className="flex flex-col gap-5 p-3.5">
        {/* Pinned above everything else, and on the phone drawer too: for a
            mentor this is the destination, not one entry among thirty. */}
        <MentorCornerButton />

        <div className="space-y-0.5">
          {PRIMARY_ITEMS.map((item) => (
            <NavRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact, search)} />
          ))}
        </div>

        {NAV_GROUPS.map((group) => (
          <CollapsibleGroup
            key={group.label}
            label={group.label}
            items={group.items}
            pathname={pathname}
            search={search}
            defaultOpen
          />
        ))}

        {SECONDARY_ITEMS.length > 0 && (
          <div className="space-y-0.5 border-t border-line/60 pt-3">
            {SECONDARY_ITEMS.map((item) => (
              <NavRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact, search)} />
            ))}
          </div>
        )}

        <div className="space-y-0.5 border-t border-line/60 pt-3">
          {SUBSCRIPTION_ITEMS.map((item) => (
            <NavRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact, search)} />
          ))}
        </div>

        {adminGroup && (
          <CollapsibleGroup
            label={adminGroup.label}
            items={adminGroup.items}
            pathname={pathname}
            search={search}
            defaultOpen
          />
        )}
      </div>
    </aside>
  );
}
