import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

function iconWrapper(path: ReactNode) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      {path}
    </svg>
  );
}

const ICONS = {
  generator: iconWrapper(
    <path
      d="M4 19.5V6a2 2 0 0 1 2-2h9l5 5v10.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z M14 4v4a1 1 0 0 0 1 1h4 M8 13h8 M8 17h5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  scheduled: iconWrapper(
    <path
      d="M8 3v3M16 3v3M4.5 9h15M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z M9 13.5l2 2 4-4.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  published: iconWrapper(
    <path
      d="M9 12.5 11.2 15 16 9.5 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  drafts: iconWrapper(
    <path
      d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M14 3v4a1 1 0 0 0 1 1h4 M8 13h8 M8 17h4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  calendar: iconWrapper(
    <path
      d="M8 3v3M16 3v3M4.5 9h15M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z M8 13h2v2H8zM11 13h2v2h-2zM14 13h2v2h-2zM8 16.5h2v2H8z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  uploads: iconWrapper(
    <path
      d="M12 16V4 M8 8l4-4 4 4 M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  statistics: iconWrapper(
    <path
      d="M4 20V10 M10 20V4 M16 20v-7 M4 20h16"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

const CONTENT_ITEMS: NavItem[] = [
  { href: "/", label: "Generator", icon: ICONS.generator },
  { href: "/scheduled", label: "Scheduled", icon: ICONS.scheduled },
  { href: "/published", label: "Published", icon: ICONS.published },
  { href: "/drafts", label: "Drafts", icon: ICONS.drafts },
];

const STANDALONE_ITEMS: NavItem[] = [
  { href: "/calendar", label: "Content Calendar", icon: ICONS.calendar },
  { href: "/uploads", label: "Uploads", icon: ICONS.uploads },
];

const STATISTICS_ITEMS: NavItem[] = [
  { href: "/statistics/applicants", label: "Applicants", icon: ICONS.statistics },
  { href: "/statistics/survey", label: "New Member Survey", icon: ICONS.statistics },
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-amber-400 text-slate-900"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      {item.icon}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 first:mt-0">
      {children}
    </p>
  );
}

export default function SidebarNav() {
  const router = useRouter();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-slate-950 px-3 py-6">
      <Link href="/" className="mb-6 flex items-center gap-2 px-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-400 text-sm font-black text-slate-900">
          S
        </span>
        <span className="text-base font-semibold text-white">Stat.ATLAS</span>
      </Link>

      <nav className="flex-1 overflow-y-auto">
        <SectionLabel>Content</SectionLabel>
        <div className="flex flex-col gap-1">
          {CONTENT_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={router.pathname === item.href}
            />
          ))}
        </div>

        <SectionLabel>Publishing</SectionLabel>
        <div className="flex flex-col gap-1">
          {STANDALONE_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={router.pathname === item.href}
            />
          ))}
        </div>

        <SectionLabel>Statistics</SectionLabel>
        <div className="flex flex-col gap-1">
          {STATISTICS_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={router.pathname === item.href}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}
