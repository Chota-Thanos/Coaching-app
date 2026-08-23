"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Compass, ChevronRight } from "lucide-react";
import { useAuth } from "../auth/auth-context";
import {
  PRIMARY_ITEMS,
  NAV_GROUPS,
  SECONDARY_ITEMS,
  getAdminGroup,
  isNavItemActive,
  type NavItem
} from "../../lib/sidebar-nav-config";

function DrawerRow({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center justify-between p-2.5 rounded-xl transition group ${
        active ? "bg-civic/10 text-civic" : "hover:bg-surface dark:hover:bg-slate-800"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-8 w-8 rounded-xl flex items-center justify-center ${
            active
              ? "bg-civic/15 text-civic"
              : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-ink dark:text-slate-100">{item.label}</p>
          {item.description && <p className="text-[10px] text-ink/50 dark:text-slate-400">{item.description}</p>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

export function SidebarDrawer() {
  const pathname = usePathname() || "/";
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const adminGroup = getAdminGroup(user);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  const drawerModal = isOpen ? (
    <div className="fixed inset-0 z-[100] lg:hidden flex h-screen w-screen overflow-hidden">
      <div
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={close}
      />

      <div className="relative ml-auto w-full max-w-[320px] xs:max-w-sm bg-surface dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 border-l border-line/60 dark:border-slate-800 animate-in slide-in-from-right duration-250">
        <div className="flex items-center justify-between p-4 border-b border-line/60 dark:border-slate-800 bg-paper/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-civic dark:bg-[#5b5bf5] text-white shadow-xs">
              <Compass className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-extrabold text-sm text-ink dark:text-white leading-none">WayToIAS Menu</h2>
              <p className="text-[11px] text-ink/50 dark:text-slate-400 font-mono mt-0.5">Full Platform Navigation</p>
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Close menu"
            className="h-9 w-9 rounded-xl bg-paper dark:bg-slate-800 text-ink dark:text-slate-200 flex items-center justify-center hover:bg-line/40 transition shadow-xs"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="space-y-1 bg-paper/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-line/40 dark:border-slate-800">
            {PRIMARY_ITEMS.map((item) => (
              <DrawerRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact)} onClick={close} />
            ))}
          </div>

          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <span className="text-[10px] font-mono font-black text-civic dark:text-[#5b5bf5] uppercase tracking-widest block px-2">
                {group.label}
              </span>
              <div className="space-y-1 bg-paper/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-line/40 dark:border-slate-800">
                {group.items.map((item) => (
                  <DrawerRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact)} onClick={close} />
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block px-2">
              More
            </span>
            <div className="space-y-1 bg-paper/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-line/40 dark:border-slate-800">
              {SECONDARY_ITEMS.map((item) => (
                <DrawerRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact)} onClick={close} />
              ))}
            </div>
          </div>

          {adminGroup && (
            <div className="space-y-2 pt-2 border-t border-line/60 dark:border-slate-800">
              <span className="text-[10px] font-mono font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block px-2">
                {adminGroup.label}
              </span>
              <div className="space-y-1 bg-paper/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-line/40 dark:border-slate-800">
                {adminGroup.items.map((item) => (
                  <DrawerRow key={item.href} item={item} active={isNavItemActive(pathname, item.href, item.exact)} onClick={close} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        className="lg:hidden h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shrink-0"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted && drawerModal && createPortal(drawerModal, document.body)}
    </>
  );
}
