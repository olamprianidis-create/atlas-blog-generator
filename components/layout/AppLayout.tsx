import { ReactNode } from "react";
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
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
