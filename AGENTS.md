<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Tripwire - rules for AI agents (read first)

Tripwire is a change-impact replanner for celebrations (weddings, birthdays, community events). When guest count, date, budget or a vendor changes, it shows which contract deadlines, minimums and caps tripped and proposes the smallest repairs that keep every hard limit intact. It is a Hack2Skill PromptWars Challenge 5 entry (deadline 1 Nov 2026, 11:59 PM IST) and a long-term portfolio project.

## Non-negotiables
1. ZERO COST. Free tools only. Never add a paid service or anything that needs a credit card. Never commit secrets (.env*, keys, tokens).
2. DETERMINISTIC CORE. All money, date, constraint and repair logic lives in src/core as pure TypeScript. src/core must not import React, the DOM, src/components, src/pages, src/hooks, src/lib or src/integrations, must not do network calls, and must not call Date.now(), new Date() without arguments, or Math.random().
3. LLM AT THE EDGES ONLY. An LLM may turn a sentence into a typed ChangeSet, explain results and draft vendor messages. It never computes or changes money, dates or constraint results.
4. MONEY = integers in minor units (paise/cents). Percentages = integer basis points (10000 = 100%). No floating-point money.
5. TIME. Every evaluation takes an explicit asOfDate (YYYY-MM-DD). Use the helpers in src/core/shared/dates.ts.
6. ONE BRANCH. Work on main only. Never create branches. Keep the repo under 10 MB (no large binaries, no build output, no node_modules).
7. UI IS LOVABLE-OWNED. Do not edit src/components/**, src/pages/** or other Lovable-generated UI files unless the task explicitly says so.

## Engineering standards
- TypeScript strict. No `any` (use `unknown` and narrow). Named exports only in src/core.
- Validate all external data with Zod at the boundary.
- Every exported function has unit tests; invariants get property tests (fast-check). Golden numbers in tests are hand-computed and must never be changed to make a test pass.
- Source files under 250 lines, test files under 400, small functions, JSDoc on exported functions.
- No new dependency without a one-line justification in your final report.
- Accessibility: semantic HTML, labelled controls, keyboard operable, WCAG 2.2 AA contrast, never colour-only status.

## Commands
- bun run check (typecheck + lint:core + format:check + tests; must be green before every commit, once it exists)
- bun run test | bun run test:coverage | bun run format | bun run lock:public

## How to work
- Read docs/DECISIONS.md first, and docs/DOMAIN.md when it exists.
- Do exactly what the task says. If something is ambiguous, or a command fails twice, STOP and report. Do not improvise.
- Never rewrite pushed history: no force-push, rebase, amend or squash of commits already pushed (Lovable syncs this branch).
- At most 2 attempts per failing command, then STOP. Never read or patch files outside this repository and never add workaround flags.
- Never claim a test passes unless you ran it and saw it pass.
- Final report: (1) files changed, (2) commands run and their real results, (3) deviations from the task, (4) open questions.
- Commit with Conventional Commits (feat:, fix:, test:, docs:, chore:). Never push.

## UI notes carried over from Lovable's original AGENTS.md
- Tripwire is one static page at `/` built with React + TypeScript + Tailwind v4 +
  shadcn/ui only: no backend, database, auth, Lovable Cloud/Supabase, external API
  calls, or analytics. Keep it that way unless asked otherwise.
- Never load fonts or assets from the network. The type pairing comes from locally
  available families, declared as `--font-display` in `src/styles.css`; colors come
  from the semantic tokens in the same file, never hardcoded utilities.
- The page keeps semantic landmarks (`header` / `main` / `footer`) and one global
  `:focus-visible` outline; the tests in `src/test/` guard those landmarks and the
  fixed copy, so run `bunx vitest run` after touching the page.
