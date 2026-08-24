"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../auth/auth-context";
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
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
        active
          ? "bg-civic/10 text-ink font-semibold dark:bg-civic/20"
          : "text-ink/70 font-medium hover:bg-paper hover:text-ink"
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function CollapsibleGroup({
  label,
  items,
  pathname,
  defaultOpen
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-semibold text-ink/50 hover:text-ink transition-colors"
      >
        <span>{label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {items.map((item) => (
            <NavRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarNav({ className = "" }: { className?: string }) {
  const pathname = usePathname() || "/";
  const { user } = useAuth();
  const adminGroup = getAdminGroup(user);

  return (
    <aside
      className={`${SIDEBAR_WIDTH} shrink-0 border-r border-line bg-surface sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto ${className}`}
      aria-label="Sidebar navigation"
    >
      <div className="flex flex-col gap-5 p-3.5">
        <div className="space-y-0.5">
          {PRIMARY_ITEMS.map((item) => (
            <NavRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact)} />
          ))}
        </div>

        {NAV_GROUPS.map((group) => (
          <CollapsibleGroup
            key={group.label}
            label={group.label}
            items={group.items}
            pathname={pathname}
            defaultOpen
          />
        ))}

        <div className="space-y-0.5 border-t border-line/60 pt-3">
          {SECONDARY_ITEMS.map((item) => (
            <NavRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact)} />
          ))}
        </div>

        <div className="space-y-0.5 border-t border-line/60 pt-3">
          {SUBSCRIPTION_ITEMS.map((item) => (
            <NavRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact)} />
          ))}
        </div>

        {adminGroup && (
          <CollapsibleGroup
            label={adminGroup.label}
            items={adminGroup.items}
            pathname={pathname}
            defaultOpen
          />
        )}
      </div>
    </aside>
  );
}
