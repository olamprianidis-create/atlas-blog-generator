import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

// Public page behind every campaign email's unsubscribe link. The opt-out
// only happens on the button click (a POST), never on page load — email
// security scanners open links automatically.
export default function UnsubscribePage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;
  const isTest = router.query.test === "1";
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function unsubscribe() {
    if (!id) return;
    setState("working");
    try {
      const response = await fetch(`/api/email/unsubscribe?id=${encodeURIComponent(id)}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Something went wrong");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  let content: React.ReactNode;
  if (!router.isReady) {
    content = null;
  } else if (isTest) {
    content = <p className="text-slate-600">This link came from a test email, so nothing was changed.</p>;
  } else if (!id) {
    content = <p className="text-slate-600">This unsubscribe link is incomplete. Please use the link from your email.</p>;
  } else if (state === "done") {
    content = (
      <>
        <h1 className="text-xl font-semibold text-slate-900">You&apos;re unsubscribed</h1>
        <p className="mt-2 text-slate-600">You won&apos;t receive these emails anymore. Thank you for being here.</p>
      </>
    );
  } else {
    content = (
      <>
        <h1 className="text-xl font-semibold text-slate-900">Unsubscribe?</h1>
        <p className="mt-2 text-slate-600">You&apos;ll stop receiving emails from Odysseas Lamprianidis.</p>
        <button
          type="button"
          onClick={unsubscribe}
          disabled={state === "working"}
          className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {state === "working" ? "Unsubscribing…" : "Unsubscribe"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Unsubscribe</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">{content}</div>
      </main>
    </>
  );
}
