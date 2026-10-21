import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tripwire — Change one thing. See what trips." },
      {
        name: "description",
        content:
          "Tripwire is a change-impact engine: change one thing and see what trips. Built for Hack2Skill PromptWars, Challenge 5.",
      },
      { property: "og:title", content: "Tripwire" },
      {
        property: "og:description",
        content: "Change one thing. See what trips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TripwirePage,
});

function TripwirePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <header className="border-b">
        <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            Tripwire
          </h1>
          <p className="mt-3 max-w-prose text-lg text-muted-foreground sm:text-xl">
            Change one thing. See what trips.
          </p>
          <div aria-hidden className="mt-8 flex items-center gap-2 sm:mt-10">
            <span className="h-px w-10 bg-border sm:w-16" />
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14"
      >
        <Card className="shadow-sm">
          <CardHeader className="border-b pb-5">
            <CardTitle>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Tripwire board
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              The change-impact engine is being built. Check back soon.
            </p>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8">
          <p className="font-mono text-xs text-muted-foreground">
            Built for Hack2Skill PromptWars - Challenge 5
          </p>
        </div>
      </footer>
    </div>
  );
}
