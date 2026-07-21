"use client";

import { useEffect, useState, useRef } from "react";
import { LogIn, LogOut, AlertCircle, Clock, UserCheck, ChevronDown, CreditCard, User, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-context";
import { browserBaseUrl } from "../../lib/api";

export function SignInPanel({ compact = false }: { compact?: boolean }) {
  const { logout, user, token } = useAuth();
  const pathname = usePathname();
  const next = encodeURIComponent(pathname || "/assessment");
  const [appStatus, setAppStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = () => {
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    menuTimeoutRef.current = setTimeout(() => setMenuOpen(false), 120);
  };

  useEffect(() => {
    if (user && user.role === "student" && token) {
      fetch(`${browserBaseUrl}/api/v1/onboarding/applications/me`, {
        headers: {
          "accept": "application/json",
          "authorization": `Bearer ${token}`
        }
      })
        .then((res) => res.json())
        .then((data: any[]) => {
          if (data && data.length > 0) {
            setAppStatus(data[0].status);
          }
        })
        .catch((err) => console.error("Failed to fetch application status in header", err));
    }
  }, [user, token]);

  useEffect(() => {
    return () => {
      if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    };
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (user) {
    const isMentor = user.role === "mentor" || appStatus === "approved";
    const canBecomeMentor = user.role === "student" && !isMentor;

    return (
      <div 
        className="relative flex items-center gap-2.5 text-sm" 
        ref={dropdownRef}
        onMouseEnter={openMenu}
        onMouseLeave={closeMenu}
      >
        {/* Dropdown Trigger Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-350 hover:bg-slate-100 hover:text-indigo-600 transition-all focus:outline-none"
        >
          <User className="h-4 w-4 text-slate-500" />
          <span>{user.username}</span>
          {isMentor && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              Mentor
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div 
            className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-100 animate-in fade-in slide-in-from-top-2 duration-150"
            onMouseEnter={openMenu}
            onMouseLeave={closeMenu}
          >
            {/* User Info Header */}
            <div className="border-b border-slate-100 px-5 py-4 bg-slate-50/50">
              <p className="text-sm font-black text-slate-800 truncate">{user.username}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {isMentor ? "Verified Mentor" : user.role === "student" ? "Student Account" : `${user.role} role`}
              </p>
            </div>

            {/* Links List */}
            <div className="p-2 space-y-1">
              {/* My Mentorship Desk */}
              {user.role === "student" && (
                <Link
                  href="/dashboard/mentorship"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 hover:bg-indigo-50 transition-colors group"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                    <UserCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-800 transition-colors">My Mentorship Desk</p>
                    <p className="text-[10px] text-slate-400 leading-none mt-0.5">Manage goals & requests</p>
                  </div>
                </Link>
              )}

              {/* Account settings */}
              <Link
                href="/account"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                  <User className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-800 transition-colors">Account Settings</p>
                  <p className="text-[10px] text-slate-400 leading-none mt-0.5">Email & password</p>
                </div>
              </Link>

              {/* My Purchases */}
              <Link
                href="/dashboard/purchases"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                  <CreditCard className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-800 transition-colors">My Purchases</p>
                  <p className="text-[10px] text-slate-400 leading-none mt-0.5">Subscriptions & billing history</p>
                </div>
              </Link>

              {/* Mentor Workspace */}
              {isMentor && (
                <Link
                  href="/mentor/workspace"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 hover:bg-indigo-50 transition-colors group"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                    <UserCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-800 transition-colors">Mentor Workspace</p>
                    <p className="text-[10px] text-slate-400 leading-none mt-0.5">Manage schedules & students</p>
                  </div>
                </Link>
              )}

              {/* Become Mentor */}
              {canBecomeMentor && (
                <>
                  {appStatus === "pending" ? (
                    <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 bg-amber-50/50 border border-amber-100/50">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
                        <Clock className="h-4 w-4 animate-spin" style={{ animationDuration: "3s" }} />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-amber-800">Review In Progress</p>
                        <p className="text-[10px] text-amber-500 leading-none mt-0.5">Onboarding application</p>
                      </div>
                    </div>
                  ) : appStatus === "more_info_required" ? (
                    <Link
                      href="/profile/apply"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 hover:bg-indigo-50 border border-dashed border-indigo-200 transition-colors group animate-pulse"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                        <AlertCircle className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-indigo-800 group-hover:text-indigo-900 transition-colors">More Info Required</p>
                        <p className="text-[10px] text-indigo-500 leading-none mt-0.5">Please update details</p>
                      </div>
                    </Link>
                  ) : (
                    <Link
                      href="/become-mentor"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 hover:bg-indigo-50 transition-colors group"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                        <User className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-800 transition-colors">Become a Mentor</p>
                        <p className="text-[10px] text-slate-400 leading-none mt-0.5">Join the mentoring panel</p>
                      </div>
                    </Link>
                  )}
                </>
              )}
            </div>

            {/* Logout Action Footer */}
            <div className="border-t border-slate-100 bg-slate-50/50 p-2">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-650 hover:border-slate-350 hover:bg-slate-50 hover:text-rose-600 transition-all"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const loginHref = `/login?next=${next}`;
  const registerHref = `/register?next=${next}`;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          href={loginHref}
        >
          <LogIn aria-hidden="true" className="h-4 w-4" />
          <span>Sign in</span>
        </Link>
        <Link
          className="hidden h-10 items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-800 transition hover:border-slate-500 hover:bg-slate-100 sm:inline-flex"
          href={registerHref}
        >
          Register
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Link
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700"
        href={loginHref}
      >
        <LogIn aria-hidden="true" className="h-4 w-4" />
        Sign in
      </Link>
      <Link
        className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-4 text-sm font-bold text-slate-800 transition hover:border-slate-550 hover:bg-slate-100"
        href={registerHref}
      >
        Create account
      </Link>
    </div>
  );
}

