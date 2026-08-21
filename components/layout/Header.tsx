import Link from "next/link";
import { useRouter } from "next/router";

const NAV_LINKS = [
  { href: "/scheduled", label: "Scheduled" },
  { href: "/published", label: "Published" },
  { href: "/drafts", label: "Drafts" },
];

export default function Header() {
  const router = useRouter();

  return (
    <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-6 flex items-center justify-between">
      <Link href="/" className="text-lg font-semibold text-slate-900 transition-colors hover:text-slate-700">
        ATLAS Blog Generator
      </Link>
      <nav className="flex items-center gap-6">
        {NAV_LINKS.map((link) => {
          const isActive = router.pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                isActive ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
