import Link from "next/link";
import { useRouter } from "next/router";

// The blog section's pages, as tabs across the top of each of them — the
// sidebar has a single "Blogs" item (SidebarNav.tsx) instead of all four.
export const BLOG_TABS = [
  { href: "/drafts", label: "Drafts" },
  { href: "/", label: "Generator" },
  { href: "/scheduled", label: "Scheduled" },
  { href: "/published", label: "Published" },
];

export function isBlogTabActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export default function BlogTabs() {
  const { pathname } = useRouter();
  return (
    <nav className="shrink-0 border-b border-slate-200 bg-white px-8">
      <div className="flex gap-1">
        {BLOG_TABS.map((tab) => {
          const active = isBlogTabActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
