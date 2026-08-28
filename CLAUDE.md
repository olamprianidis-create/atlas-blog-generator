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
- image_url (text, nullable — see 0004_header_image.sql)
- author_user_id (text, nullable — see 0009_article_author.sql and "Author picker" below)
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
1a. **"Anthropic response was truncated (hit max_tokens=...)" is not a credits/billing issue** — it means a call's `maxTokens` option was too low for how long that response actually needed to be, so `anthropic.ts` deliberately throws instead of silently returning cut-off JSON/text (see its `truncated` check). If this shows up on a step that previously worked fine, the fix is raising that call's `maxTokens`, not checking account balance. Already hit and fixed twice: `utils/keywordResearch.ts`'s call (4096→8192, 2026-08-27) and `utils/outline.ts`'s call (2048→4096, 2026-08-27) — if it recurs elsewhere, check every `generateJSON`/`generateText` call site's `maxTokens` against how much structured output that prompt actually asks for (e.g. outline's 5 FAQs + 4-6 topic-breakdown sections + hook/takeaways/CTA needs real headroom).
2. **Scheduled-article publishing is checked every ~10 minutes, not continuously** — see "Scheduled publishing" below. It is NOT instant at the exact publish time.
3. **Article template changes** - Keep Blog_Structure_Prompt_UPDATED.md in sync with generation logic
4. **Web search can fail** - Have graceful fallback to previous research data
5. **Keyword spreadsheet** - User provides this; code retrieves dynamically
6. **.env.local is gitignored** - Store secrets safely, never commit API keys
7. **Markdown formatting must be perfect** - Broken markdown = broken article rendering

---

## API cost optimizations (2026-08-27)

A cost audit found the blog-generation pipeline was running more/pricier Anthropic calls than needed per article. Four fixes landed, all preserving output quality:

- **Web search consolidated from 8 calls to 4** (`utils/webSearch.ts`'s `runResearch()`, `utils/keywordResearch.ts`'s `researchKeywords()`). Keyword research used to run its own 4-query search batch (People Also Ask, related searches, long-tail, competitor) completely independently of `runResearch()`'s own 4-query batch (trends, statistics, research, expert opinion) — heavily overlapping ground, double the search-tool billing. `runResearch()`'s 4 queries are now written broadly enough to serve both purposes, and `researchKeywords()` takes that same `ResearchQuery[]` as a parameter instead of searching itself (`pages/api/research-keywords.ts` now runs `runResearch()` once and passes its result into both `generateOutline`'s eventual research input and `researchKeywords()`). The keyword-classification prompt still asks Claude to infer `source` per keyword ("whichever search it came from or most resembles") since findings are no longer strictly separated by originating query.
- **Prompt caching on the article template** (`utils/anthropic.ts`'s new `cachedContext` option on `GenerateOptions`, used by `utils/article.ts`'s `generateArticle()`). `Blog_Structure_Prompt_UPDATED.md` (~1,500 tokens) plus its wrapping instruction is now sent as a separate `cache_control: {type: "ephemeral"}` content block ahead of the per-article prompt, instead of being interpolated into one plain string — repeat calls within the ~5-minute cache window (retries, back-to-back generations) get billed the ~90%-cheaper cached rate for that block instead of full price. Only helps once a cached block is at/above Anthropic's cache minimum (1024 tokens for Sonnet) — not applied to `generateJSON`'s short fixed system instruction, which is well under that floor and would see zero benefit.
- **Trivial calls routed to a cheaper model** (`utils/anthropic.ts`'s new `CLASSIFICATION_MODEL` export, currently `claude-haiku-4-5-20251001`). `webSearch()` (the individual search-tool calls, now defaulting to this model) and `extractTopicPhrase()` in `utils/topicExtraction.ts` don't need full Sonnet-level reasoning for retrieval/short-classification work — `utils/outline.ts` and `utils/article.ts`'s full generation calls stay on `DEFAULT_MODEL` (Sonnet) since output quality matters most there.
- **Retry behavior reviewed, left as-is** — `withRetry()` in `utils/anthropic.ts` only retries on 429/5xx, never on 4xx validation errors, so a bad prompt was never silently re-billed 3x; this was already correct.

Net effect: a single article generation now fires 4 web searches instead of 8 (all on the cheaper model), and the article-writing call reuses a cached template block on repeat calls — no change to the actual article/outline/keyword output quality, verified via a real end-to-end generation against the live API after these changes.

---

## Reference documents (Step 1, `components/steps/DocumentUpload.tsx`, `utils/documentExtraction.ts`, `utils/referenceDocuments.ts`)

Step 1 has an optional "Reference Documents" upload — one or more PDF, Word (`.docx`), plain text/Markdown, or CSV files the admin wants an article to draw from (a report, raw data, internal notes, etc.), on top of the live web search findings.

- **Upload flow**: browser uploads straight to Vercel Blob via `@vercel/blob/client`'s `upload()` (`pages/api/upload-document.ts` only hands out a client token, same pattern as video uploads), then the client immediately calls `POST /api/extract-document` with the resulting blob URL — that route fetches the file server-side and extracts plain text with `utils/documentExtraction.ts` (`pdf-parse` for PDFs, `mammoth` for `.docx`, a raw read for `.txt`/`.md`/`.csv`). The extracted text (capped at 20,000 characters per document) is what actually gets kept in wizard state — `components/steps/DocumentUpload.tsx`'s `UploadedDocument[]` is `{name, extractedText, charCount}`, threaded through `pages/index.tsx` exactly like `authorUserId`/`headerImageUrl` (state → `DraftState`'s jsonb blob → `buildDraftState`/`applyDraftState`/`handleRestart`). **No new Supabase migration or env var was needed** — `BLOB_READ_WRITE_TOKEN` already existed from the Uploads feature, and documents only need to survive the in-progress wizard/draft, not the published article record.
- **How the model uses it**: `utils/referenceDocuments.ts`'s `documentsToResearchQueries()` reshapes each uploaded document into the same `ResearchQuery` shape (`{query, findings}`) as a web search result — `pages/api/generate-outline.ts` and `pages/api/generate-article.ts` both merge document-derived entries onto the existing `research` array before calling `generateOutline()`/`generateArticle()`, so uploaded documents read as additional research context the model weaves in naturally, no separate prompt section needed. Documents are **not** fed into keyword research (`researchKeywords()`) — that step's source classification (`people_also_ask`/`related_searches`/etc.) doesn't fit arbitrary document content well, and the ask was specifically "add within the article," not mine documents for SEO keywords.
- **Regeneration tracking**: `pages/index.tsx`'s outline/article "did the inputs change since last generation" signatures include a `documentKeys` fingerprint (`name:charCount` per document) — so adding/removing a reference document after already generating an outline correctly triggers a regeneration instead of silently being ignored.

## Collapsible sidebar (`components/layout/SidebarNav.tsx`)

The left sidebar can collapse to an icon-only rail (`w-[4.5rem]`) via a button at its bottom, down from its normal `w-60` — nav labels, the "Stat.ATLAS" wordmark, and section headings (replaced by a thin divider) hide, and each icon gets a `title` tooltip. Collapsed/expanded state is persisted to `localStorage` (`statAtlasSidebarCollapsed`), not React state alone — this is the Pages Router, so every page mounts its own fresh `<AppLayout>`/`<SidebarNav>` on navigation (no shared persistent layout), and state would otherwise reset on every page change.

## Published-articles bug: status silently downgraded on re-save (fixed 2026-08-27)

`pages/api/schedule-article.ts`'s update branch (used whenever the wizard is re-opened for an existing `articleId` — e.g. editing from the Scheduled page, or going back to Step 4/5 after publishing) used to unconditionally set `status: "scheduled"` on the row it updated, with no check of the row's *current* status first. If that article had since been published — either by the ~10-min publish cron firing while the admin had it open, or by the admin going back into the wizard after already publishing — the re-save silently reverted it to `"scheduled"`, and it vanished from the Published page (which filters `.eq("status", "published")`) with no error shown anywhere. Fixed by reading the row's current status before updating and forcing `status: "published"` back into the update payload whenever it already was — every other field (content, keywords, image, author, etc.) still updates normally either way.

A second, unrelated bug in the same area: `pages/api/published-articles.ts` selected `linkedin_status`/`linkedin_error` unconditionally with no fallback if `supabase/migrations/0008_linkedin.sql` hadn't been run — unlike every other optional-column query in this codebase, a missing column here failed the *entire* query (`42703: column does not exist`), so the Published page showed **zero** articles, not just some missing. Fixed to match the established graceful-degradation pattern (retry without those columns, default `linkedin_status` to `"not_posted"` if so). Confirmed via a live query against production data that this was in fact the active cause — `0008_linkedin.sql` still hasn't been run as of this writing (same as `0007_uploads.sql`; see "Platform setup checklist").

## Article analytics (Published page → Statistics button)

Per-article view/engagement stats, added 2026-08-27. Nothing existed anywhere for this before — no analytics SDK, no view-tracking table, on either app. Built from scratch across both repos:

- **Schema**: `supabase/migrations/0010_article_analytics.sql` — **run this migration manually in the Supabase SQL editor** (same as every other pending one in this project) — 3 insert-only tables: `article_impressions` (an article card was shown on the Website's `/articles` listing page), `article_page_views` (someone opened `/article/[slug]`, with `referrer_category` and `device_type`), `article_view_durations` (a second insert fired via `sendBeacon` on page-hide, carrying how long the page stayed open). Split into 3 tables specifically so every write is a plain INSERT — an UPDATE would've needed a much more permissive (and riskier) RLS policy for the Website's public anon key to use.
- **Who writes**: the ATLAS Website, using its **existing** `SUPABASE_ANON_KEY` (no new credentials anywhere) — `src/lib/supabase.ts` there has `recordArticleImpression`/`recordArticleView`/`recordArticleViewDuration`, each wrapped in try/catch (best-effort, must never break page rendering if the migration isn't run yet or a write fails). New App Router routes `src/app/api/track/{impression,view,duration}/route.ts` are the same-origin endpoints the browser actually calls, so no `NEXT_PUBLIC_*` env vars were needed either.
- **What triggers a write, and how "clicks"/CTR are defined**: `src/components/analytics/ImpressionTrackedLink.tsx` (an `IntersectionObserver`-based drop-in for `next/link`, fires one impression the first time a link scrolls into view) wraps every article link on `/articles` — the Featured hero, "The Latest"/"Trending" side lists, "Member Publishings", and `ArticleCard` in "All Articles". `src/components/analytics/ArticleViewTracker.tsx` (mounted once on `/article/[slug]`) records the view on mount and the duration via `sendBeacon`/`pagehide`. **A "click" is defined as a view whose `referrer_category` is `"internal_listing"`** (i.e. `document.referrer`'s path was exactly `/articles`) — there's no separate click event; CTR = those views ÷ impressions on the listing page. Both tracking components check `navigator.webdriver`/a bot-UA regex first and no-op for anything that looks automated (this is also why Playwright-driven verification of live tracking doesn't show real inserts — confirmed instead by hitting the `/api/track/*` routes directly).
- **Who reads**: `utils/articleAnalytics.ts`'s `getArticleStats(articleId)` here in Stat.ATLAS, using the existing service-role client (bypasses RLS) — computes total views, unique viewers (distinct `visitor_id`), average time on page, impressions, clicks, CTR, a views-by-day series, and referrer/device breakdowns. Exposed via `GET /api/published-articles/[id]/stats`, rendered on the new `pages/published/[id]/stats.tsx` page (a hand-rolled CSS bar chart for the views trend — no charting library added), linked from a "Statistics" button on each article in `pages/published.tsx`. Every number falls back to `0`/`—`/"No data yet" rather than erroring if the migration hasn't been run.
- **Visitor identity**: a random UUID in the Website visitor's `localStorage` (`atlas_visitor_id`, `src/lib/analytics-client.ts`), not a cookie — no consent-banner implications, and it's specific to that browser only (private windows / cleared storage get a fresh id, which is an accepted undercount).

## Topics/categories (`utils/types.ts` `CATEGORIES`, mirrored in the Website's `ArticleCategory` type)

The category list is a single source of truth in `utils/types.ts` — the dropdown, filters, and Supabase's `category` column all read from it, so adding a new one (e.g. Finance, added 2026-08-27) means: add it to `CATEGORIES` here, add it to the mirrored `ArticleCategory` union in the Website's `src/lib/supabase.ts`, and add a migration widening the Postgres enum (`supabase/migrations/0011_add_finance_category.sql` — **run this manually**, `ALTER TYPE ... ADD VALUE` can't be applied any other way from this environment). No color-map or other hardcoded category list exists elsewhere in either repo to keep in sync.

---

## Workflow Notes

- **Generate step:** Uses live web search for fresh data + keyword spreadsheet
- **Review step:** User approves outline, keywords, and research findings
- **Generate step:** Writes full article with all AI optimization signals
- **Schedule step:** Stores in Supabase with publish_date, triggers on schedule
- **Quality gates:** 35-point checklist runs automatically (don't skip it)

---

## Scheduled publishing

`pages/api/cron/publish-scheduled.ts` publishes every `scheduled_articles` row whose `publish_date` is due, **and** (since 2026-08-28) every due `video_uploads` row (see "Uploads" below) — one endpoint, one workflow, both kinds of scheduled content. Two things call it:
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
- **Scheduling is now automated** (fixed 2026-08-28 — previously a row saved as "pending" just sat there forever with nothing ever picking it up, which is exactly what happened the first time this was tried: a video showed "Scheduled" on the Uploads page but never appeared in YouTube Studio, because nothing had ever actually called YouTube's API). `utils/publishVideo.ts`'s `publishVideoUploadById()` is the one place that actually calls `uploadVideoToYoutube()`/`publishVideoToTiktok()` — both the immediate-publish path (`pages/api/uploads/index.ts`, called synchronously right after insert) and the scheduled path (`pages/api/cron/publish-scheduled.ts`, the same endpoint/workflow that publishes scheduled articles — see "Scheduled publishing" above) call this same function, so scheduling isn't a second, drifting implementation. A row is inserted as `pending` regardless of immediate-vs-scheduled; the cron only picks up rows with a **due, non-null `publish_at`** still `pending` on at least one targeted platform (an immediate upload has `publish_at: null` and is already handled synchronously, so it never matches the cron's query).
- **`utils/youtube.ts`/`utils/tiktok.ts`** hold all API logic (OAuth, token refresh, publish calls) — same "don't call the API directly" convention as `utils/anthropic.ts`. `utils/publishVideo.ts` is the orchestration layer above them (fetches the row, decides what's due, calls the right one(s), writes the result back) — don't call `uploadVideoToYoutube()`/`publishVideoToTiktok()` directly from a route, go through `publishVideoUploadById()` instead so both publish paths stay in sync.

## LinkedIn (`pages/published.tsx`, `utils/linkedin.ts`)

Automatically shares a link post ("this article is live", title + meta description + a link back to the article on atlasnetwork.club) to the connected LinkedIn profile's feed whenever a blog article is published — hooked into `publishArticleById()` in `utils/publish.ts`, right after it flips `scheduled_articles.status` to `"published"`. This posts **as your personal LinkedIn profile**, not a Company Page — Company Page posting needs `w_organization_social` + LinkedIn's Marketing Developer Platform partner approval, a much heavier process than the self-serve "Share on LinkedIn" product this uses.

- **Not a native LinkedIn Article** — LinkedIn's long-form Articles/Newsletters (Pulse) have no publish API at all, full stop; this posts a normal feed post whose `content.article` is a link card pointing at the real article, which is the actual automatable option.
- **Not connected yet** — needs the same kind of developer-portal setup as YouTube/TikTok (see "Platform setup checklist" below) before the automatic post-publish share will do anything but record a `not_connected` status.
- **Best-effort, never blocks a publish** — `postArticleToLinkedinBestEffort()` in `utils/publish.ts` catches every error itself; a LinkedIn failure only sets `scheduled_articles.linkedin_status`/`linkedin_error`, it never fails the publish (`publishArticleById()`'s return value only reflects whether the article itself published). The Published page (`pages/published.tsx`) shows that status per article plus a manual "Share to LinkedIn" button (`POST /api/published-articles/[id]/linkedin`) — used for articles published before LinkedIn was connected, or to retry a failure.
- **Tokens expire in 60 days with no refresh token by default** — LinkedIn's standard OAuth doesn't issue a refresh token unless you separately apply for its "Programmatic Refresh Tokens" product. Reconnecting periodically via the Published page's "Connect" button is the expected flow otherwise; an expired connection surfaces as `linkedin_status: "not_connected"` on the next publish, same as never having connected.
- Reuses the `platform_connections` table from the Uploads feature (`supabase/migrations/0008_linkedin.sql` widens its `platform` check constraint to include `'linkedin'`, and adds `linkedin_status`/`linkedin_post_urn`/`linkedin_error`/`linkedin_posted_at` to `scheduled_articles`) — **run this migration manually in the Supabase SQL editor**, same as 0007.

## Content Calendar (`pages/calendar.tsx`, `content_calendar_events`)

Shows three independent kinds of chips on the same monthly grid, one per targeted platform per item (a video posted to both YouTube and TikTok shows as two separate chips, never one combined blob):
1. **Blog posts** — read from **both** `/api/scheduled-articles` and `/api/published-articles` merged client-side (a blog post never gets written into `content_calendar_events`), tagged `status: "scheduled" | "published"`. Both statuses now render in the same `BLOG_POST_COLOR_CLASS` (no separate scheduled/published colors as of 2026-08-28 — simplified per explicit request).
2. **Video uploads** (YouTube/TikTok) — read from `/api/uploads`, flattened one chip per targeted-and-attempted platform (`flattenVideoUploads()`). Date used: `published_at` → `publish_at` → `created_at` fallback.
3. **Manual platform events** (Instagram/Pinterest/etc., `content_calendar_events` — see `supabase/migrations/0006_content_calendar.sql`, a table deliberately separate from the blog/video pipelines) — created/edited via the day modal.

**Fixed 2026-08-27**: the calendar used to only fetch `/api/scheduled-articles`, which by design only returns `status = "scheduled"` rows (that same endpoint also backs the Scheduled page, which must never show already-published articles). The moment a post actually published, it fell out of that query and its chip vanished from the calendar entirely. Fixed by merging in `/api/published-articles` too.

**Per-item checkboxes, replacing the old single whole-day checkbox (fixed 2026-08-28)**: the calendar used to have one manual checkbox per day (`content_calendar_days` table, now unused/orphaned — not dropped, just no longer referenced) with no connection to what actually happened that day. Replaced with a checkbox on every individual chip:
- **Blog posts and video uploads are fully automatic** — the checkbox just reflects `status === "published"` (real publish state from the pipelines described above/elsewhere in this doc), not clickable. There's no manual override; it should only ever show what actually happened.
- **Manual platform events are still manually toggled** — there's no automated posting pipeline for Instagram/Pinterest/etc. (unlike YouTube/TikTok/blog), so there's no way to know automatically whether you actually posted. `content_calendar_events.completed_platforms` (`supabase/migrations/0012_calendar_event_completion.sql` — **run this migration manually in the Supabase SQL editor**) is a text array of which of that event's targeted platforms have been checked off, independently — an event targeting both Instagram and Pinterest can have Instagram checked without Pinterest being checked. A platform-less event uses the literal string `"general"` as its one entry. Toggled via `POST /api/calendar/events/[id]/complete`. The events GET/POST/PATCH routes all degrade gracefully (retry without `completed_platforms`, defaulting to `[]`) if the migration hasn't been run yet, same convention as every other optional-column addition in this codebase.
- The day cell itself changed from a `<button>` to a `<div role="button">` — chips now contain their own nested interactive checkbox `<button>`s, and nesting interactive controls inside a real `<button>` is invalid HTML that silently breaks click handling (same root cause as the Uploads page video-in-`<Link>` bug — see "Uploads" above).

**Platform list note**: `utils/types.ts`'s `Platform`/`PLATFORMS` no longer includes `facebook` (dropped 2026-08-28, per explicit request to trim the calendar's color legend to exactly Blog/Instagram/YouTube/TikTok/Pinterest) and has never included `linkedin` — if either is asked for again, add it back to that one array (used by the event `PlatformPicker`, the calendar legend, and chip coloring).

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

## Author picker (Step 1, `components/steps/AuthorPicker.tsx`, `pages/api/authors.ts`)

Step 1 has an optional "Author" field — a searchable dropdown of real ATLAS members, letting an admin credit a blog article to a specific member. Selecting one stores that member's **ATLAS Website `User.id`** as `scheduled_articles.author_user_id` (plain text, no real FK — different Postgres instance).

- **Always queried live, on every dropdown open** — reuses the same read-only `WEBSITE_DATABASE_URL` connection as Statistics (`listAtlasMembersForAuthorPicker()` in `utils/websiteDb.ts`, `GET /api/authors`), so the member list is always exactly current with **zero scheduled sync job and zero extra env vars**. (An earlier plan was a cached snapshot refreshed every 2 weeks via a scheduled job, like the article-publish cron — deliberately not built, since live is simpler and more accurate for a dataset this small.)
- **Threaded through the whole wizard like `headerImageUrl`** — `authorUserId` lives in `pages/index.tsx`'s state and `DraftState` (drafts need no migration, `state` is a jsonb blob), gets sent as `authorUserId` to `POST /api/schedule-article`, and is restored from `author_user_id` when editing an existing scheduled article (`GET /api/scheduled-articles/[id]`) — including if the admin navigates back to Step 1 mid-edit.
- **`author_user_id` is an optional column** (`supabase/migrations/0009_article_author.sql`, not yet run as of 2026-08-27 — **run this migration manually in the Supabase SQL editor**, no CLI/DB-URL access to apply it from this environment). Both the insert and update paths in `schedule-article.ts`, and the read in `scheduled-articles/[id].ts`, degrade gracefully (retry without the column) if it's missing — same convention as `image_url`.
- **The actual Author display box lives on the ATLAS Website**, not here — `src/app/article/[slug]/page.tsx` there resolves `author_user_id` against its own `User`/`Profile` tables at render time (`getArticleAuthor()` in its `src/lib/db.ts`) rather than storing a denormalized name/photo copy, so the displayed name/photo/join-date is always current even if the member edits their profile later. Shows photo, full name, "Member Since" (date + day count), and a black pill "View Profile" button linking to `/members/{slug}` — which itself respects that member's PRIVATE/PUBLIC visibility setting (see the Website's own CLAUDE.md), so the button redirects a logged-out reader to login for a Private author.

## Git Conventions

- Branch naming: `feature/blog-generator`, `fix/supabase-sync`
- Commits: Clear, concise messages referencing the feature/fix
- PRs: Link to checklist item if applicable

**Don't commit:** .env.local, node_modules, .supabase/
