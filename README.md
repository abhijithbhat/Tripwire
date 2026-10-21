# Tripwire

Change one thing. See what trips.

Tripwire is a change-impact replanner for celebrations. When the guest count, date, budget or a vendor changes, it shows which contract deadlines, minimums and caps just tripped and proposes the smallest repairs that keep every hard limit intact.

Status: under active development (Hack2Skill PromptWars Challenge 5).

## Principles
- Deterministic core: money, dates, constraints and repairs are plain TypeScript with tests.
- LLM at the edges only: parsing, explanations and message drafts, never numbers.
- Zero-cost stack: free tiers only; AI features degrade gracefully.

## Run locally
    npm install
    npm run dev
    npm run check

## Docs
- docs/DECISIONS.md - architecture decision records
