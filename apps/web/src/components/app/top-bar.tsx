import Link from "next/link";
import { WayToIASLogo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { SignInPanel } from "../auth/sign-in-panel";
import { SidebarDrawer } from "./sidebar-drawer";
import { SubscriptionStatusLink } from "../billing/subscription-status-link";
import { MentorCornerButton } from "./mentor-corner-button";
import { UserCircle } from "lucide-react";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-line/60 bg-surface/95 shadow-card backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <SidebarDrawer />
          <Link className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity select-none" href="/" title="Way To IAS Home">
            <WayToIASLogo className="h-8 w-auto" />
            <span className="hidden sm:inline text-[13px] font-bold tracking-tight text-ink leading-tight">
              Way To IAS
            </span>
          </Link>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          {/* Renders only for mentors, and never inside the corner itself. */}
          <MentorCornerButton compact />
          <SubscriptionStatusLink compact />
          {/* `/profile` has no page -- only `/profile/apply` exists -- so this
              button had always 404'd. The account screen is `/account`.

              Hidden on phones because the signed-in menu beside it already has
              an Account Settings entry, and on a 375px screen this duplicate
              was what pushed the header's controls into each other. */}
          <Link
            href="/account"
            title="Your account"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-line text-slate-500 transition hover:border-civic/40 hover:text-ink sm:flex"
          >
            <UserCircle className="h-[18px] w-[18px]" strokeWidth={2} />
          </Link>
          <ThemeToggle />
          <SignInPanel compact />
        </div>
      </div>
    </header>
  );
}
