import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rendererPaths = ["app-shell.tsx", "app.tsx", "project-hub.tsx", "repository-setup.tsx", "status-states.tsx"]
  .map((file) => fileURLToPath(new URL(`../src/renderer/${file}`, import.meta.url)));

describe("Renderer security boundary", () => {
  it("does not import Node or Electron APIs directly", async () => {
    for (const rendererPath of rendererPaths) {
      const source = await readFile(rendererPath, "utf8");
      expect(source).not.toMatch(/from ["'](?:node:|electron)/);
      expect(source).not.toMatch(/require\(["'](?:node:|electron)/);
    }
  });
});
