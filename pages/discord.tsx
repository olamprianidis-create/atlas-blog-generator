import { useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";

interface DiscordChannel {
  id: string;
  label: string;
  channel_id: string;
  is_default: boolean;
}

const inputClass =
  "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const cardClass = "rounded-lg border border-slate-200 bg-white p-4";

export default function DiscordPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);

  const [newLabel, setNewLabel] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [composeChannelId, setComposeChannelId] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  function loadChannels() {
    fetch("/api/discord/channels")
      .then((res) => res.json())
      .then((data: { configured: boolean; channels: DiscordChannel[] }) => {
        setConfigured(data.configured);
        setChannels(data.channels ?? []);
        if (!composeChannelId && data.channels?.length) {
          setComposeChannelId(data.channels[0].channel_id);
        }
      })
      .catch((err) => console.error("Failed to load Discord channels:", err));
  }

  useEffect(() => {
    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!newLabel.trim() || !newChannelId.trim()) {
      setAddError("Both a label and a channel ID are required.");
      return;
    }
    setIsAdding(true);
    try {
      const res = await fetch("/api/discord/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim(), channelId: newChannelId.trim(), isDefault: channels.length === 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save channel.");
      setNewLabel("");
      setNewChannelId("");
      loadChannels();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to save channel.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await fetch(`/api/discord/channels/${id}`, { method: "PATCH" });
      loadChannels();
    } catch (err) {
      console.error("Failed to set default channel:", err);
    }
  }

  async function handleDeleteChannel(id: string) {
    if (!window.confirm("Remove this saved channel?")) return;
    try {
      await fetch(`/api/discord/channels/${id}`, { method: "DELETE" });
      loadChannels();
    } catch (err) {
      console.error("Failed to delete channel:", err);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSendError(null);
    setSendSuccess(null);
    if (!composeChannelId.trim()) {
      setSendError("Pick or enter a channel ID first.");
      return;
    }
    if (!composeMessage.trim()) {
      setSendError("Write a message first.");
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch("/api/discord/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: composeChannelId.trim(), message: composeMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send message.");
      setSendSuccess("Sent.");
      setComposeMessage("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Discord</h1>
          <p className="mt-1 text-sm text-slate-500">
            Post messages to any channel in your server, and optionally auto-post whenever something publishes.
          </p>

          <div className={`mt-6 flex items-center gap-3 ${cardClass}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
              D
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">Bot</p>
              <p className="text-xs text-slate-500">
                {configured === null
                  ? "Checking…"
                  : configured
                    ? "Configured — DISCORD_BOT_TOKEN is set."
                    : "Not configured — set DISCORD_BOT_TOKEN in the environment first."}
              </p>
            </div>
          </div>

          <div className={`mt-6 ${cardClass}`}>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Saved channels</p>
            <p className="mt-1 text-xs text-slate-400">
              The default channel (marked below) is where new articles/videos get auto-posted on publish.
            </p>

            {channels.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No channels saved yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {channels.map((ch) => (
                  <li key={ch.id} className="flex items-center gap-3 rounded-md border border-slate-200 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{ch.label}</p>
                      <p className="truncate text-xs text-slate-400">{ch.channel_id}</p>
                    </div>
                    {ch.is_default ? (
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Default
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(ch.id)}
                        className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                      >
                        Make default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteChannel(ch.id)}
                      className="shrink-0 text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddChannel} className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (e.g. #general)"
                className={inputClass}
              />
              <input
                value={newChannelId}
                onChange={(e) => setNewChannelId(e.target.value)}
                placeholder="Channel ID"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={isAdding}
                className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAdding ? "Adding…" : "Add"}
              </button>
            </form>
            {addError && <p className="mt-2 text-xs text-red-600">{addError}</p>}
            <p className="mt-2 text-xs text-slate-400">
              To get a channel ID: enable Developer Mode in Discord (Settings → Advanced), then right-click a
              channel → Copy Channel ID.
            </p>
          </div>

          <div className={`mt-6 ${cardClass}`}>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Send a message</p>
            <form onSubmit={handleSend} className="mt-3 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Channel</label>
                {channels.length > 0 ? (
                  <select value={composeChannelId} onChange={(e) => setComposeChannelId(e.target.value)} className={inputClass}>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.channel_id}>
                        {ch.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={composeChannelId}
                    onChange={(e) => setComposeChannelId(e.target.value)}
                    placeholder="Channel ID"
                    className={inputClass}
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Message</label>
                <textarea
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  rows={4}
                  className={inputClass}
                  placeholder="What do you want to post?"
                />
              </div>
              {sendError && <p className="text-xs text-red-600">{sendError}</p>}
              {sendSuccess && <p className="text-xs text-green-700">{sendSuccess}</p>}
              <button
                type="submit"
                disabled={isSending}
                className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? "Sending…" : "Send"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
