import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TripwirePage } from "@/routes/index";

// The rules this page must keep: semantic landmarks, and the exact copy the
// brief fixes. Rendered directly — the page uses no router hooks.
describe("Tripwire page", () => {
  it("names the product and tagline inside a header landmark", () => {
    render(<TripwirePage />);

    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("heading", { level: 1 })).toHaveTextContent("Tripwire");
    expect(
      within(banner).getByText("Change one thing. See what trips."),
    ).toBeInTheDocument();
  });

  it("puts the board card with the build note inside the main landmark", () => {
    render(<TripwirePage />);

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 2 })).toHaveTextContent("Tripwire board");
    expect(
      within(main).getByText("The change-impact engine is being built. Check back soon."),
    ).toBeInTheDocument();
  });

  it("credits the challenge inside a footer landmark", () => {
    render(<TripwirePage />);

    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Built for Hack2Skill PromptWars - Challenge 5",
    );
  });
});
