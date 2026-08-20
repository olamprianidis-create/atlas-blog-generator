# ATLAS Blog Structure & Quality Template

This is the reference template for full article generation (Step 3). It
defines the required structure, sourcing rules, and the 30-point quality
checklist that every generated article is scored against.

> Authored as part of Phase 5 scaffolding since CLAUDE.md references this
> file but it didn't exist yet. Edit freely — the checklist in
> `utils/qualityChecklist.ts` mirrors the 30 points below, so keep them in
> sync if you change this file.

## Required sections

1. **H1 title**
2. **Hook** — 1-2 sentence opening, no heading, immediately after the title
3. **30-second answer** — direct answer to the core question, before the first H2
4. **Topic breakdown** — 4-6 `##` sections covering the subject in depth
5. **Example** — a concrete example or mini case study, as its own `##` section
6. **FAQs** — a `## Frequently Asked Questions` section with exactly 5 `###` questions
7. **Key takeaways** — a `##` section with a bullet list
8. **CTA** — a closing `##` section, must mention the `@atlasnetwork.club` Instagram
9. **Related reading** — a closing `##` section with exactly 3 internal links

## Length

- 1,500–2,500 words total
- No paragraph should run longer than ~150 words (readability)

## E-E-A-T signals (Experience, Expertise, Authority, Trustworthiness)

- **Experience** — first-hand or observational framing ("in practice", "what actually works")
- **Expertise** — clear command of the subject, specific and non-generic advice
- **Authority** — references to research, data, or named experts/institutions
- **Trust** — citations/links backing up claims, no unsupported absolute claims

## Source distribution (60/40 rule)

- **60% external links** — authoritative, recognizable sources (e.g. Forbes, Harvard Business Review, Mayo Clinic, CDC, APA, ESPN — pick sources relevant to the category)
- **40% internal links** — atlasnetwork.club articles
- Internal links: 2-3 woven naturally into body paragraphs, plus exactly 3 in the closing "Related Reading" section
- All links use proper markdown format: `[Anchor Text](URL)`

> External link URLs are model-generated (or placeholder, in mock mode)
> and are **not live-verified**. Always manually check external links
> resolve correctly before publishing.

## Keywords

- Main keyword appears in the body and in at least one heading
- At least 2 long-tail/suggested keywords appear naturally in the body

## Meta description

- 450–500 characters
- Includes the main keyword and at least 2 long-tail keywords
- Written to be catchy in a Google search preview

## CTA

- Mentions `@atlasnetwork.club` on Instagram
- Includes a clear action verb (follow, share, subscribe, etc.)

---

## 30-point quality checklist

Structure (7):
1. Has an H1 title
2. Has at least one H2 section
3. Has at least one H3 (used for FAQs)
4. Has a hook paragraph before the first heading
5. Has a "Frequently Asked Questions" section
6. Has exactly 5 FAQ items
7. Has a closing CTA section

Length (3):
8. Word count is at least 1,500
9. Word count is at most 2,500
10. No paragraph exceeds ~150 words

E-E-A-T (4):
11. Contains an authority/expertise signal
12. Contains a first-hand experience signal
13. Contains a research/data/expert reference
14. Contains a trust signal (citation or source link)

Sourcing & links (6):
15. Has at least 1 external link
16. Has at least 1 internal atlasnetwork.club link
17. External links are ~60%+ of total links
18. At least 2 internal links appear in the body
19. Exactly 3 internal links appear in the closing Related Reading section
20. All links use proper markdown `[text](url)` format

Keywords (3):
21. Main keyword appears in the article body
22. At least 2 long-tail keywords appear in the article body
23. Main keyword appears in a heading

CTA & social (2):
24. CTA mentions the `@atlasnetwork.club` Instagram
25. CTA includes a clear call-to-action verb

Meta description (2):
26. Meta description is 450–500 characters
27. Meta description contains the main keyword

Formatting integrity (3):
28. No broken/unclosed markdown link syntax
29. No leftover placeholder tokens in the final output
30. Headings follow a sane hierarchy (starts with H1, no orphaned jumps)
