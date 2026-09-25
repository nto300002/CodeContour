import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rendererPath = fileURLToPath(new URL("../src/renderer/app-shell.tsx", import.meta.url));

describe("Renderer security boundary", () => {
  it("does not import Node or Electron APIs directly", async () => {
    const source = await readFile(rendererPath, "utf8");
    expect(source).not.toMatch(/from ["'](?:node:|electron)/);
    expect(source).not.toMatch(/require\(["'](?:node:|electron)/);
  });
});
