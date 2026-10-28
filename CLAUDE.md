# Rules from the owner

These override any tool's default guidance.

## Never

- **Never create artifacts or publish anything to claude.ai.** No Artifact tool calls, no Claude Docs, no share links, no "page to view" — code, mockups, notes, summaries. Work is reviewed locally.
- **Never commit or push.** When asked to prepare a commit, only stage files (`git add`), then say what is staged and what was left out. Do not create branches.
- Don't run slow or expensive jobs — deploys, migrations, exports — unless asked.
- Don't use Playwright or screenshots to check work unless asked. Use the project's checks instead (below).

## How to work with me

- **Default to TL;DR answers.** Give the short version first; I'll ask if I want more.
- **Be brief.** The recommendation or result in a few short lines. Skip justification, caveats and verification detail unless asked. One line saying it was checked is enough.
- **Questions are not requests.** When I ask a question, answer it; don't change code until I ask for the change.
- **Ask before big builds.** If the direction is unclear, ask with concrete options. Don't build a lot of work from a guess.
- **Don't invent facts.** Only state what I've told you or what you can verify in the code. If unsure, ask.
- **Quote claims back exactly.** For user-facing copy, docs and product claims, show each sentence word for word and get a yes on each. A general "yes" doesn't cover every detail.
- **Remember corrections.** When I correct you or set a preference, keep it for the session and suggest adding hard rules to this file.

## Verification

Run these from `web/`:

```bash
bun run lint
bun run typecheck
bun run build
```

## Repo notes

- I run the app from a CLI outside the devcontainer, never inside it. `web/.env.local` is intentionally not available in the container. Don't flag it or suggest mounting or copying env vars; give me commands to run on my machine instead.

- `ai_docs/_new_context_prompt.md` is my starting prompt for a new session: read `docs/` first to get a sense of the project, and tell me what you plan to do before doing work.
- `web/AGENTS.md` holds the app's conventions (design tokens, mockup structure, commands); `web/CLAUDE.md` imports it.
- Schema lives at the repo root in `supabase/`. `0001_baseline.sql` is applied once per environment and frozen; every change is a new numbered file. Never edit a migration that has been applied anywhere.

## UI work

- Layouts must work at every screen size, including resized desktop windows and odd tablet sizes. Check a range of widths and heights, not only common devices.
- Everything clickable shows the pointer hand on desktop. `web/app/globals.css` sets it for buttons and other controls; anything else made clickable needs `cursor-pointer`.
- Text must never clip or overlap, including during animations. Check rendered text lines, not just container sizes.
