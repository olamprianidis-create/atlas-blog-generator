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

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
          ← Back
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Terms of Service</h1>
        <p className="mt-1 text-sm text-slate-400">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          These Terms of Service ("Terms") govern access to and use of this application ("Stat.ATLAS," "the Tool,"
          "we," "us"), an internal content-operations tool built and operated by Odysseas Lamprianidis ("the
          Developer," "the Operator") for ATLAS Network. The Tool is not a public consumer product; it is restricted
          to authorized ATLAS Network administrators. By accessing or using the Tool, the administrator agrees to
          these Terms in full.
        </p>

        <Section title="1. Authorized use only">
          <p>
            Access to the Tool is limited to individuals the Developer has explicitly authorized. The Tool is
            provided solely for drafting, scheduling, and publishing ATLAS Network content — blog articles, videos,
            calendar notes — to the ATLAS Network website and to third-party platforms the administrator connects
            (currently YouTube, TikTok, LinkedIn, Google Calendar, and Discord). Any other use is outside the scope
            of this license.
          </p>
        </Section>

        <Section title="2. Ownership">
          <p>
            The Tool, its source code, design, and underlying infrastructure are owned solely by the Developer.
            Content created or published through the Tool (articles, videos, calendar notes, and related metadata)
            belongs to ATLAS Network / the administrator who created it, subject to whatever separate rights ATLAS
            Network and the Developer have agreed between themselves outside of these Terms.
          </p>
        </Section>

        <Section title="3. Acceptable use">
          <p>
            The administrator agrees not to use the Tool to publish unlawful content, to violate any connected
            third-party platform's own terms of service, to attempt to circumvent the Tool's access restrictions, or
            to interfere with the Tool's operation (including its automated scheduling and publishing jobs). The
            Developer may suspend or revoke access at any time, for any reason, without notice.
          </p>
        </Section>

        <Section title="4. Third-party platforms">
          <p>
            The Tool integrates with third-party platforms (YouTube, TikTok, LinkedIn, Google Calendar, Discord) via
            each platform's own API and OAuth consent flow. Use of those platforms through the Tool is also governed
            by each platform's own terms of service, which the administrator is independently responsible for
            complying with. The Developer is not responsible for those platforms' availability, API changes, content
            moderation decisions, or any action taken against a connected account.
          </p>
        </Section>

        <Section title="5. No warranty">
          <p>
            THE TOOL IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
            INCLUDING WITHOUT LIMITATION ANY WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
            NON-INFRINGEMENT, ACCURACY, OR UNINTERRUPTED OR ERROR-FREE OPERATION. THE DEVELOPER DOES NOT WARRANT
            THAT ANY CONTENT PUBLISHED THROUGH THE TOOL WILL BE ACCEPTED, DISPLAYED, OR RETAINED BY ANY THIRD-PARTY
            PLATFORM, OR THAT THE TOOL WILL BE FREE OF BUGS, DOWNTIME, OR DATA LOSS.
          </p>
        </Section>

        <Section title="6. Limitation of liability">
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

        <Section title="7. Indemnification">
          <p>
            The administrator using this Tool agrees to indemnify and hold the Developer harmless from any claim,
            liability, loss, or expense (including reasonable legal fees) arising from content published through the
            Tool, misuse of the Tool, or violation of any connected third-party platform's terms of service.
          </p>
        </Section>

        <Section title="8. Termination">
          <p>
            The Developer may suspend or terminate access to the Tool at any time, with or without cause or notice.
            Sections 2, 5, 6, and 7 survive any termination of access.
          </p>
        </Section>

        <Section title="9. Changes to these Terms">
          <p>
            These Terms may be updated at any time to reflect changes in the Tool's functionality or connected
            platforms. The "Last updated" date above will change accordingly; continued use of the Tool after an
            update constitutes acceptance of the revised Terms. No separate notice will be given.
          </p>
        </Section>

        <Section title="10. Governing law">
          <p>
            These Terms are governed by the laws applicable to the Developer's place of business, without regard to
            conflict-of-law principles.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions about these Terms can be sent to{" "}
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
