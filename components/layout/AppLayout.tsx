import { ReactNode } from "react";
import Link from "next/link";
import SidebarNav from "./SidebarNav";

export default function AppLayout({
  children,
  header,
  contentClassName = "flex flex-1 flex-col overflow-hidden",
}: {
  children: ReactNode;
  // Full-width bar above the page content (e.g. BlogTabs).
  header?: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        {header}
        <div className={contentClassName}>{children}</div>
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
          <Link href="/privacy" className="hover:text-slate-600 hover:underline">
            Privacy Policy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-slate-600 hover:underline">
            Terms of Service
          </Link>
        </footer>
      </div>
    </div>
  );
}
