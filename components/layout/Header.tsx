import Link from "next/link";

export default function Header() {
  return (
    <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-6 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-slate-900">ATLAS Blog Generator</h1>
      <Link
        href="/drafts"
        className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        Drafts
      </Link>
    </header>
  );
}
