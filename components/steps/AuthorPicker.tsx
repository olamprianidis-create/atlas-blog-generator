import { useEffect, useRef, useState } from "react";
import type { AtlasMemberOption } from "../../utils/websiteDb";

interface AuthorPickerProps {
  value: string | null;
  onChange: (memberId: string | null) => void;
}

export default function AuthorPicker({ value, onChange }: AuthorPickerProps) {
  const [members, setMembers] = useState<AtlasMemberOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/authors")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load members");
        setMembers(data as AtlasMemberOption[]);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Failed to load members");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    searchInputRef.current?.focus();

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedMember = members.find((m) => m.id === value) ?? null;
  const filteredMembers = members.filter((m) =>
    m.fullName.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <span className="flex items-center gap-2">
          {selectedMember?.profileImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedMember.profileImageUrl}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
          )}
          <span className={selectedMember ? "text-slate-900" : "text-slate-400"}>
            {selectedMember ? selectedMember.fullName : "No author (optional)"}
          </span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search members..."
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {isLoading && <p className="px-3 py-2 text-sm text-slate-400">Loading members...</p>}
            {loadError && <p className="px-3 py-2 text-sm text-red-600">{loadError}</p>}
            {!isLoading && !loadError && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
                >
                  No author
                </button>
                {filteredMembers.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-400">No matching members.</p>
                ) : (
                  filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        onChange(member.id);
                        setIsOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                        member.id === value ? "bg-blue-50 text-blue-700" : "text-slate-900"
                      }`}
                    >
                      {member.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.profileImageUrl}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <span className="h-6 w-6 shrink-0 rounded-full bg-slate-100" />
                      )}
                      {member.fullName}
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
