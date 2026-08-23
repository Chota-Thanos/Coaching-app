import Link from "next/link";
import { WayToIASLogo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { SignInPanel } from "../auth/sign-in-panel";
import { SidebarDrawer } from "./sidebar-drawer";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-line/60 bg-surface/95 shadow-card backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-6">
        <div className="flex items-center gap-3">
          <SidebarDrawer />
          <Link className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity select-none" href="/" title="Way To IAS Home">
            <WayToIASLogo className="h-8 w-auto" />
            <span className="hidden sm:inline text-[13px] font-bold tracking-tight text-ink leading-tight">
              Way To IAS
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignInPanel compact />
        </div>
      </div>
    </header>
  );
}
