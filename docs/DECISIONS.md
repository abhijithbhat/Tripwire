# Decision log

## ADR-001 - Zero-cost stack
Context: no budget for tools, hosting or API keys. Decision: GitHub (public repo), Lovable free plan (UI), Antigravity free plan (build), Cloudflare Workers free plan (hosting and AI gateway), free LLM tiers only. Consequence: AI features must degrade gracefully when quotas run out; the core demo never depends on an LLM.

## ADR-002 - Deterministic core, LLM at the edges
Context: LLMs often break hard constraints such as budget caps when new preferences arrive (Flex-TravelPlanner, 2025). Decision: all money, date and constraint logic is plain TypeScript; an LLM may only parse a change sentence, explain results and draft messages, and its output is schema-validated. Consequence: results are reproducible and testable; AI is an optional layer.

## ADR-003 - Money in minor units, percentages in basis points
Decision: Money is an integer number of paise or cents; percentages are integer basis points; rounding is half away from zero, applied once per rule; split payments give the remainder to the last part so sums are exact. Consequence: no floating-point drift; totals reproduce to the paisa.

## ADR-004 - Explicit asOfDate
Decision: the engine never reads the clock; every evaluation receives asOfDate. Consequence: deterministic tests and reproducible demos.

## ADR-005 - One repository, engine inside the Lovable project
Context: Lovable cannot import an existing repository and syncs one branch of one repository. Decision: the engine lives in src/core of the Lovable-created repo, with lint rules that keep it framework-free; the UI is generated in Lovable; the core and gateway are built in Antigravity. Consequence: one repo, one branch, one CI pipeline.

## ADR-006 - Bun as the single package manager
Context: Lovable's toolchain uses bun. A parallel npm lockfile falls out of sync with the first dependency Lovable adds and breaks `npm ci`; `legacy-peer-deps` hid a resolver crash and also stopped peer dependencies (@testing-library/dom) from installing, which broke the UI tests. Lovable's bun.lock can reference a private Lovable mirror that is unreachable outside Lovable's network. Decision: bun is the only package manager; scripts/normalize-bun-lock.mjs rewrites the mirror host to public npm before install (idempotent, integrity hashes unchanged); CI installs with --frozen-lockfile. Consequence: one lockfile, reproducible CI, working UI tests.

