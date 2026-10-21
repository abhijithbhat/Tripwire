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

# Tripwire

- Tripwire is one static page at `/` built with React + TypeScript + Tailwind v4 +
  shadcn/ui only: no backend, database, auth, Lovable Cloud/Supabase, external API
  calls, or analytics. Keep it that way unless asked otherwise.
- Never load fonts or assets from the network. The type pairing comes from locally
  available families, declared as `--font-display` in `src/styles.css`; colors come
  from the semantic tokens in the same file, never hardcoded utilities.
- The page keeps semantic landmarks (`header` / `main` / `footer`) and one global
  `:focus-visible` outline; the tests in `src/test/` guard those landmarks and the
  fixed copy, so run `bunx vitest run` after touching the page.
