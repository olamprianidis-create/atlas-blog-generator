# CLAUDE.md - Stat.ATLAS

## Project Overview
Stat.ATLAS (formerly "ATLAS Blog Generator" — renamed 2026-08-25 as the tool grew beyond just blog articles into general content operations) is an automated content creation and publishing tool for atlasnetwork.club. Its blog pipeline generates SEO-optimized articles, optimizing for ChatGPT Search, Claude Search, and Google AI Overviews simultaneously using the blog template framework (Blog_Structure_Prompt_UPDATED.md). It also handles cross-posting video content to TikTok and YouTube (see "Uploads" below).

**Core Workflow:**
1. Generate Outline + Keywords (with live web search)
2. User reviews and approves
3. Generate Full Article (with E-E-A-T optimization)
4. User schedules and stores in Supabase

---

## Article Formatting & Style

All generated blog articles must follow these visual and textual guidelines:

### Hook Section (Opening)
- Start with 3-5 **single-line statements** (not paragraphs)
- Each line should stand alone
- Use line breaks between statements to ease reader into article
- Make opening feel accessible, not dense
- Example:
  > Most men struggle with this.
  >
  > Nobody talks about why.
  >
  > The science is clear—here's what to do.

### Paragraph Length & Pacing
- **Maximum 3 sentences per paragraph** (hard cap)
- **Target: 2 sentences per paragraph** (ideal)
- Break up long thoughts across multiple short paragraphs
- Use whitespace generously—visual breathing room improves readability
- Never write dense blocks of text (looks intimidating)

### Lists & Formatting
- Use **bullet points** frequently (minimum 2-3 per article)
- Use **numbered lists** for step-by-step content (minimum 1-2 per article)
- Lists should break up sections naturally
- Each bullet/number should be 1-2 sentences max

### Pull Quotes (Centerpiece)
- Add 1-2 **centerpiece quotes** per article (1,500+ word articles)
- Format as **center-aligned, larger text** in a styled box
- Use a markdown blockquote with this exact shape so it renders styled:
  ```markdown
  > **"Your powerful statement here."**
  >
  > *Make this line impactful*
  ```

This is enforced two ways: the generation prompt (`utils/article.ts`) instructs
the model to follow it, and the 35-point quality checklist
(`utils/qualityChecklist.ts`, mirrored in `Blog_Structure_Prompt_UPDATED.md`)
scores every generated article against it — checks 31-35 are the brand-voice
checks specifically.

---

## Environment Setup

### Required .env.local variables:
```
ANTHROPIC_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
```

### Setup commands:
```bash
# Install dependencies
npm install

# Initialize Supabase connection
npx supabase status

# Test Anthropic API
npm run test:anthropic

# Run dev server
npm run dev
```

---

## Code Style & Architecture

### Frontend
- React functional components + hooks
- TypeScript for type safety
- Tailwind CSS for styling
- Component structure: `/components` (UI), `/pages` (routes), `/utils` (helpers)

### Backend Integration
- `/utils/anthropic.ts` - Anthropic API wrapper (use this, don't call API directly)
- `/utils/supabase.ts` - Supabase client (handles auth, article storage)
- `/utils/webSearch.ts` - Web search integration (live trend data)

### Key Architectural Decisions
- **Store markdown in Supabase** (not HTML) - Next.js renders dynamically
- **Frontmatter format** for article metadata (title, keywords, publish_date, etc.)
- **Scheduled articles table** triggers webhook at publish time
- **35-point quality checklist** runs before user review (automate quality gates)

---

## Supabase Schema Reference

### Table: scheduled_articles
```
- id (uuid, primary key)
- title (text)
- content_markdown (text)
- content_html (text, generated on publish)
- keywords (jsonb array)
- meta_description (text)
- category (enum: entrepreneurship, health, mental_health, community, friends, sports)
- internal_links (jsonb array)
- external_links (jsonb array)
- publish_date (timestamp)
- status (enum: draft, scheduled, published)
- created_at (timestamp)
- updated_at (timestamp)
```

### Table: article_history
```
- id (uuid, primary key)
- user_prompt (text)
- outline_generated (jsonb)
- keywords_used (jsonb)
- article_id (fk to scheduled_articles)
- created_at (timestamp)
```

---

## Testing & Verification

**Always run verification checklist after article generation:**
```bash
npm run test:article-quality
```

**Test specific components:**
```bash
npm test -- --testPathPattern=anthropic      # API integration
npm test -- --testPathPattern=supabase       # Database operations
npm test -- --testPathPattern=formatting     # Markdown formatting
```

**Manual verification:**
- Check article markdown parses correctly: `npm run lint:md`
- Verify Supabase connection: `npx supabase status`
- Test scheduling logic: `npm run test:schedule`

---

## Blog Template Reference

**The complete blog template is at:** `Blog_Structure_Prompt_UPDATED.md`

Key sections Claude uses:
- Author Context/Expertise Signal (E-E-A-T)
- FAQ Schema (featured snippet optimization)
- 60/40 source distribution (external/internal)
- E-E-A-T checklist (Experience, Expertise, Authority, Trustworthiness)

Always reference this template when generating outlines and articles.

---

## Common Gotchas

1. **Don't call Anthropic API directly** - Use `/utils/anthropic.ts` wrapper (handles retry logic)
2. **Scheduled-article publishing is checked every ~10 minutes, not continuously** — see "Scheduled publishing" below. It is NOT instant at the exact publish time.
3. **Article template changes** - Keep Blog_Structure_Prompt_UPDATED.md in sync with generation logic
4. **Web search can fail** - Have graceful fallback to previous research data
5. **Keyword spreadsheet** - User provides this; code retrieves dynamically
6. **.env.local is gitignored** - Store secrets safely, never commit API keys
7. **Markdown formatting must be perfect** - Broken markdown = broken article rendering

---

## Workflow Notes

- **Generate step:** Uses live web search for fresh data + keyword spreadsheet
- **Review step:** User approves outline, keywords, and research findings
- **Generate step:** Writes full article with all AI optimization signals
- **Schedule step:** Stores in Supabase with publish_date, triggers on schedule
- **Quality gates:** 35-point checklist runs automatically (don't skip it)

---

## Scheduled publishing

`pages/api/cron/publish-scheduled.ts` publishes every `scheduled_articles` row whose `publish_date` is due. Two things call it:
- `vercel.json`'s native Vercel Cron entry — fires once a day. **This project is on Vercel's Hobby plan, which caps cron jobs at once/day regardless of the schedule string in vercel.json** — don't "fix" a publishing delay by just tightening that schedule, it silently won't take effect without a Pro upgrade.
- `.github/workflows/publish-cron.yml` — a GitHub Actions scheduled workflow that hits the same endpoint every ~10 minutes via `curl` with `Authorization: Bearer ${{ secrets.CRON_SECRET }}`. This is the one actually keeping publish times close to on-schedule; it needs a `CRON_SECRET` repo secret (Settings → Secrets and variables → Actions) matching the `CRON_SECRET` env var already set in Vercel production — added manually since there's no CLI/API access to GitHub repo secrets from this environment. GitHub Actions schedules aren't perfectly precise either (GitHub can delay them under load), so treat "every ~10 min" as approximate, not exact.

If an article ever appears stuck as `status: "scheduled"` past its `publish_date`, first check whether the GitHub Actions workflow is actually running (repo's Actions tab) before assuming the publish logic itself is broken — you can also trigger it manually with `workflow_dispatch`, or hit `/api/cron/publish-scheduled` directly with the `CRON_SECRET` bearer token.

## Layout (`components/layout/AppLayout.tsx`, `SidebarNav.tsx`)

Every page renders `<AppLayout>` (not a per-page header) — a fixed-width black left sidebar (`SidebarNav.tsx`, brand + grouped nav links, amber-400 active pill) plus the page's own scrollable content area. Renamed from a top horizontal `Header.tsx` + dropdown menus (removed 2026-08-25) to this left-nav layout. `AppLayout`'s `contentClassName` prop defaults to a single-column content wrapper; the one exception is `pages/index.tsx`, which passes `"flex flex-1 overflow-hidden"` so its own wizard-progress `Sidebar.tsx` (step 1-5 tracker, unrelated to `SidebarNav.tsx` — don't confuse the two) can sit beside its `<main>`. Adding a new top-level page means adding it to the relevant group array in `SidebarNav.tsx`.

## Uploads (`pages/uploads.tsx`, `utils/youtube.ts`, `utils/tiktok.ts`)

Cross-posts a single video to YouTube and/or TikTok from one form — video file, thumbnail, title/description/tags, then per-platform options (YouTube: privacy/category/made-for-kids; TikTok: privacy/comments/duet/stitch/cover-frame-timestamp). Backed by two new Supabase tables (`supabase/migrations/0007_uploads.sql` — **run this migration manually in the Supabase SQL editor**, there's no CLI/DB-URL access to apply it from this environment): `platform_connections` (one row per platform's OAuth tokens) and `video_uploads` (one row per submitted video, independent `youtube_status`/`tiktok_status` so one platform failing doesn't block or hide the other's result).

- **Video upload bypasses our server entirely** — `pages/uploads.tsx` uses `@vercel/blob/client`'s `upload()` directly from the browser to Blob storage (`pages/api/upload-video.ts` only hands out a short-lived client token via `handleUpload`). Routing large video files through a normal API route would hit Vercel's serverless request-body limit; this is the same reason `pages/api/upload-image.ts` (thumbnails, small images) can stay on the simpler raw-body pattern and this can't.
- **Neither platform is connected yet** — both need real developer-portal setup before publishing will work (the "Connect" buttons on the Uploads page will error until then). `APP_URL` below is this app's own deployed URL (e.g. `https://stat-atlas.vercel.app`) — **not** `utils/site.ts`'s `SITE_URL` constant, which is the unrelated, hardcoded `atlasnetwork.club` (ATLAS Website) URL. Full numbered steps for all three integrations (this, plus LinkedIn below) are in "Platform setup checklist" further down.
  - **YouTube**: Google Cloud project → enable "YouTube Data API v3" → OAuth 2.0 Web client → redirect URI `${APP_URL}/api/auth/youtube/callback` → `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET`/`APP_URL` in `.env.local` and Vercel. While the OAuth consent screen is in "Testing" mode, only test users you add can authorize, and their tokens need re-consent every 7 days — publish the app (or add the ATLAS account as a test user) accordingly.
  - **TikTok**: TikTok for Developers app → add "Content Posting API" product → redirect URI `${APP_URL}/api/auth/tiktok/callback` → **verify `APP_URL`'s domain** (required for `PULL_FROM_URL` video publishing — the method used here, since the video already has a public Blob URL and doesn't need a second chunked upload) → `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET`. Public "Direct Post" additionally requires TikTok's app audit approval — until that's granted, publishing only works for the developer's own sandboxed TikTok account.
- **Scheduling is stored but not automated** — picking "Schedule for later" saves `publish_at` on the row (status `pending`) but nothing currently polls it and flips it to publishing, unlike the blog article pipeline's cron (see "Scheduled publishing" below). Publish those manually when the time comes, or wire up a cron similar to `publish-scheduled.ts` if this becomes a regular need.
- **`utils/youtube.ts`/`utils/tiktok.ts`** hold all API logic (OAuth, token refresh, publish calls) — same "don't call the API directly" convention as `utils/anthropic.ts`.

## LinkedIn (`pages/published.tsx`, `utils/linkedin.ts`)

Automatically shares a link post ("this article is live", title + meta description + a link back to the article on atlasnetwork.club) to the connected LinkedIn profile's feed whenever a blog article is published — hooked into `publishArticleById()` in `utils/publish.ts`, right after it flips `scheduled_articles.status` to `"published"`. This posts **as your personal LinkedIn profile**, not a Company Page — Company Page posting needs `w_organization_social` + LinkedIn's Marketing Developer Platform partner approval, a much heavier process than the self-serve "Share on LinkedIn" product this uses.

- **Not a native LinkedIn Article** — LinkedIn's long-form Articles/Newsletters (Pulse) have no publish API at all, full stop; this posts a normal feed post whose `content.article` is a link card pointing at the real article, which is the actual automatable option.
- **Not connected yet** — needs the same kind of developer-portal setup as YouTube/TikTok (see "Platform setup checklist" below) before the automatic post-publish share will do anything but record a `not_connected` status.
- **Best-effort, never blocks a publish** — `postArticleToLinkedinBestEffort()` in `utils/publish.ts` catches every error itself; a LinkedIn failure only sets `scheduled_articles.linkedin_status`/`linkedin_error`, it never fails the publish (`publishArticleById()`'s return value only reflects whether the article itself published). The Published page (`pages/published.tsx`) shows that status per article plus a manual "Share to LinkedIn" button (`POST /api/published-articles/[id]/linkedin`) — used for articles published before LinkedIn was connected, or to retry a failure.
- **Tokens expire in 60 days with no refresh token by default** — LinkedIn's standard OAuth doesn't issue a refresh token unless you separately apply for its "Programmatic Refresh Tokens" product. Reconnecting periodically via the Published page's "Connect" button is the expected flow otherwise; an expired connection surfaces as `linkedin_status: "not_connected"` on the next publish, same as never having connected.
- Reuses the `platform_connections` table from the Uploads feature (`supabase/migrations/0008_linkedin.sql` widens its `platform` check constraint to include `'linkedin'`, and adds `linkedin_status`/`linkedin_post_urn`/`linkedin_error`/`linkedin_posted_at` to `scheduled_articles`) — **run this migration manually in the Supabase SQL editor**, same as 0007.

## Platform setup checklist (YouTube, TikTok, LinkedIn)

None of the three auto-posting integrations work until their developer-portal app exists and its credentials are in `.env.local`/Vercel. This is a one-time setup Claude can't do on your behalf (each requires logging into a developer console with your own account):

1. **Apply the pending migrations** — `supabase/migrations/0007_uploads.sql` and `0008_linkedin.sql`, run manually in the Supabase SQL editor (Supabase project → SQL Editor → paste → Run). Nothing below works without these tables existing.
2. **Set `APP_URL`** in `.env.local` (and Vercel) to this app's real deployed URL — every platform's redirect URI is built from it.
3. **YouTube**: [Google Cloud Console](https://console.cloud.google.com) → new project → enable "YouTube Data API v3" (APIs & Services → Library) → OAuth consent screen (External, add your ATLAS account as a test user) → Credentials → OAuth client ID (Web application) → add `${APP_URL}/api/auth/youtube/callback` under Authorized redirect URIs → copy the client ID/secret into `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET`.
4. **TikTok**: [TikTok for Developers](https://developers.tiktok.com) → create an app → add the "Content Posting API" product → Manage apps → add `${APP_URL}/api/auth/tiktok/callback` as a redirect URI → verify `APP_URL`'s domain (Content Posting API settings — required for `PULL_FROM_URL`) → copy the client key/secret into `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET`. Submit for app audit when ready to post publicly (not required to test against your own sandboxed account first).
5. **LinkedIn**: [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) → create an app (needs an associated LinkedIn Company Page, even though posts go to your personal profile — LinkedIn requires this to create any app) → Products tab → add both "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn" (both self-serve, no review) → Auth tab → add `${APP_URL}/api/auth/linkedin/callback` under Authorized redirect URLs → copy the Client ID/Secret into `LINKEDIN_CLIENT_ID`/`LINKEDIN_CLIENT_SECRET`.
6. Deploy with the new env vars set, then click each platform's "Connect" button (YouTube/TikTok on the Uploads page, LinkedIn on the Published page) and complete that platform's OAuth consent screen once.

## Statistics (`pages/statistics/`)

Two admin-only report pages reading from the **ATLAS Website's** database, not this app's own Supabase:
- **Applicants** (`/statistics/applicants`) — public "Join The Network" requests submitted on atlasnetwork.club (`MembershipRequest` table).
- **New Member Survey** (`/statistics/survey`) — the 3-question "Your Thoughts" answers from the Website's post-signup onboarding flow (`OnboardingResponse` table, joined to `User`), filtered to the last 90 days.

Both go through `utils/websiteDb.ts`, a read-only `pg` `Pool` against `WEBSITE_DATABASE_URL` — the **same Neon connection string** as the ATLAS Website project's `DATABASE_URL`, kept as a separate env var here (set in both `.env.local` and Vercel production/preview) since these are two independent Vercel projects. Never write through this connection — if either dataset ever needs a write path from this app, add a real API route on the Website instead of writing directly to its DB from here. The Website itself has no UI for either dataset anymore (no `/results` page there) — this is the only place they're viewed.

## Git Conventions

- Branch naming: `feature/blog-generator`, `fix/supabase-sync`
- Commits: Clear, concise messages referencing the feature/fix
- PRs: Link to checklist item if applicable

**Don't commit:** .env.local, node_modules, .supabase/
