import Link from "next/link";

const LAST_UPDATED = "August 30, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
          ← Back
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Privacy Policy</h1>
        <p className="mt-1 text-sm text-slate-400">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          This application ("Stat.ATLAS," "the Tool," "we," "us") is an internal content-operations tool built and
          operated by Odysseas Lamprianidis ("the Developer," "the Operator") for ATLAS Network. It is not a public
          consumer product — access is restricted to authorized ATLAS Network administrators, and it exists to draft,
          schedule, and publish content (blog articles, videos, calendar notes) to the ATLAS Network website and to
          third-party platforms the Operator connects it to (currently YouTube, TikTok, LinkedIn, Google Calendar,
          and Discord).
        </p>

        <Section title="1. What this Tool does">
          <p>
            The Tool lets its authorized administrator generate and schedule blog articles, upload videos, plan a
            content calendar, and — when the administrator explicitly connects an account — publish or sync content
            to third-party platforms on the administrator's behalf. Every third-party connection is opt-in and
            initiated by the administrator; the Tool never connects to or posts on a platform without that platform's
            own OAuth consent screen having been completed first.
          </p>
        </Section>

        <Section title="2. Information we process">
          <p>To do the above, the Tool stores and processes:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-slate-700">OAuth credentials</span> (access tokens, refresh tokens,
              and associated account identifiers) for any platform the administrator connects — YouTube, TikTok,
              LinkedIn, and Google Calendar.
            </li>
            <li>
              <span className="font-medium text-slate-700">Content the administrator creates</span> — article text,
              images, video files, calendar notes, and related metadata (titles, descriptions, tags, scheduling
              times).
            </li>
            <li>
              <span className="font-medium text-slate-700">A bot token</span> for Discord (configured directly by the
              Operator as server infrastructure, not collected from any end user).
            </li>
            <li>
              <span className="font-medium text-slate-700">Basic operational data</span> such as publish status,
              timestamps, and error logs needed to run scheduled/automated publishing reliably.
            </li>
          </ul>
          <p>
            The Tool does not knowingly collect information from the general public. It has no public sign-up, no
            visitor tracking, and no advertising or analytics SDKs of its own.
          </p>
        </Section>

        <Section title="3. How this information is used">
          <p>
            Solely to operate the Tool as described above: authenticating to connected platforms, publishing or
            syncing the administrator's own content to them, and keeping an accurate record of what has and hasn't
            been published. Nothing collected here is sold, rented, or used for advertising, and nothing is shared
            with any party beyond what is strictly necessary to complete the publishing action the administrator
            requested (e.g., sending a video to YouTube's API to publish it).
          </p>
        </Section>

        <Section title="4. Storage and security">
          <p>
            Data is stored in a managed Postgres database (Supabase) accessed only via a private service-role
            connection that is never exposed to a browser or to any third party. Reasonable technical safeguards are
            used, but — as set out in Section 7 below — no storage system can be guaranteed perfectly secure, and the
            Tool is provided without warranty of any kind on that front.
          </p>
        </Section>

        <Section title="5. Third-party platforms">
          <p>
            When the administrator connects YouTube, TikTok, LinkedIn, Google Calendar, or Discord, those platforms'
            own privacy policies and terms govern how they handle any data exchanged with them. The Developer is not
            responsible for those platforms' independent data practices, downtime, API changes, content moderation
            decisions, or account actions (including suspension or termination of a connected account), all of which
            are entirely outside the Developer's control.
          </p>
        </Section>

        <Section title="6. Data retention and deletion">
          <p>
            Credentials for a connected platform are retained until the administrator disconnects that platform or
            requests their deletion, at which point they are removed. Published content remains as part of the
            operational record of what was published where. Any deletion request can be made directly to the
            Developer at the contact below.
          </p>
        </Section>

        <Section title="7. Disclaimer of warranties">
          <p>
            THE TOOL IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
            INCLUDING WITHOUT LIMITATION ANY WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
            NON-INFRINGEMENT, ACCURACY, OR UNINTERRUPTED OR ERROR-FREE OPERATION. THE DEVELOPER DOES NOT WARRANT
            THAT ANY CONTENT PUBLISHED THROUGH THE TOOL WILL BE ACCEPTED, DISPLAYED, OR RETAINED BY ANY THIRD-PARTY
            PLATFORM, OR THAT THE TOOL WILL BE FREE OF BUGS, DOWNTIME, OR DATA LOSS.
          </p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, THE DEVELOPER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
            SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, REVENUE, GOODWILL, OR
            OPPORTUNITY, ARISING OUT OF OR RELATED TO THE USE OF, OR INABILITY TO USE, THE TOOL — INCLUDING DAMAGES
            CAUSED BY A CONNECTED THIRD-PARTY PLATFORM'S ACTIONS, API CHANGES, OR OUTAGES — EVEN IF THE DEVELOPER HAS
            BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IN NO EVENT SHALL THE DEVELOPER'S TOTAL AGGREGATE
            LIABILITY ARISING OUT OF OR RELATED TO THE TOOL EXCEED ZERO DOLLARS ($0), THE TOOL BEING PROVIDED FREE OF
            CHARGE AND FOR INTERNAL USE ONLY.
          </p>
        </Section>

        <Section title="9. Indemnification">
          <p>
            The administrator using this Tool agrees to indemnify and hold the Developer harmless from any claim,
            liability, loss, or expense (including reasonable legal fees) arising from content published through the
            Tool, misuse of the Tool, or violation of any connected third-party platform's terms of service.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            This policy may be updated at any time to reflect changes in the Tool's functionality or connected
            platforms. The "Last updated" date above will change accordingly; continued use of the Tool after an
            update constitutes acceptance of the revised policy. No separate notice will be given.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions about this policy, or requests regarding stored data, can be sent to{" "}
            <a href="mailto:olamprianidis@gmail.com" className="text-blue-600 hover:underline">
              olamprianidis@gmail.com
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}
