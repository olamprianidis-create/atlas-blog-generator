import { ReactNode } from "react";
import Link from "next/link";
import SidebarNav from "./SidebarNav";

export default function AppLayout({
  children,
  contentClassName = "flex flex-1 flex-col overflow-hidden",
}: {
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className={contentClassName}>{children}</div>
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
          <Link href="/privacy" className="hover:text-slate-600 hover:underline">
            Privacy Policy
          </Link>
        </footer>
      </div>
    </div>
  );
}
