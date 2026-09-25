import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell, isProjectNavigationEnabled, screenDefinitions } from "../src/renderer/app-shell.js";

describe("AppShell", () => {
  it("makes all seven screens available from one shared shell", () => {
    expect(screenDefinitions.map((screen) => screen.id)).toEqual([
      "project-hub",
      "repository-setup",
      "initial-analysis",
      "workspace",
      "repository-reconnect",
      "global-settings",
      "project-settings",
    ]);
    const html = renderToStaticMarkup(<AppShell activeScreen="project-hub" project={null}><main>Project Hub</main></AppShell>);
    expect(html).toContain('data-shell="project-hub"');
    expect(html).toContain("Project Hub");
  });

  it("uses an independently scrollable three-pane workspace", () => {
    const html = renderToStaticMarkup(
      <AppShell activeScreen="workspace" activeView="feature-map" project={{ id: "project-1", name: "CodeContour" }}>
        <main>Feature Map</main>
      </AppShell>,
    );

    expect(html).toContain('data-layout="workspace-three-pane"');
    expect(html).toContain('data-pane="navigation"');
    expect(html).toContain('data-pane="canvas"');
    expect(html).toContain('data-pane="inspector"');
    expect((html.match(/overflow:auto/g) ?? [])).toHaveLength(3);
    expect(html).toContain('aria-current="page"');
  });

  it("disables project-dependent navigation until a project is selected", () => {
    expect(isProjectNavigationEnabled(null)).toBe(false);
    expect(isProjectNavigationEnabled({ id: "project-1", name: "CodeContour" })).toBe(true);

    const html = renderToStaticMarkup(<AppShell activeScreen="project-hub" project={null}><main>Project Hub</main></AppShell>);
    expect(html).toContain('data-project-navigation="disabled"');
    expect(html).toContain('disabled=""');
  });
});
