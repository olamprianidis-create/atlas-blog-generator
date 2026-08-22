import Link from "next/link";
import { useRouter } from "next/router";
import HoverDropdown from "./HoverDropdown";

const BLOG_GENERATOR_LINKS = [
  { href: "/scheduled", label: "Scheduled" },
  { href: "/published", label: "Published" },
  { href: "/drafts", label: "Drafts" },
];

const NAV_LINK_CLASSES = "text-sm font-medium transition-colors";

export default function Header() {
  const router = useRouter();
  const isBlogGeneratorActive =
    router.pathname === "/" || BLOG_GENERATOR_LINKS.some((link) => link.href === router.pathname);
  const isCalendarActive = router.pathname === "/calendar";

  return (
    <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-6 flex items-center justify-between">
      <Link href="/" className="text-lg font-semibold text-slate-900 transition-colors hover:text-slate-700">
        ATLAS Content
      </Link>
      <nav className="flex items-center gap-6">
        <HoverDropdown
          align="left"
          trigger={
            <Link
              href="/"
              className={`${NAV_LINK_CLASSES} ${isBlogGeneratorActive ? "text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
            >
              Blog Generator
            </Link>
          }
        >
          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            {BLOG_GENERATOR_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </HoverDropdown>
        <Link
          href="/calendar"
          className={`${NAV_LINK_CLASSES} ${isCalendarActive ? "text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
        >
          Calendar
        </Link>
      </nav>
    </header>
  );
}
