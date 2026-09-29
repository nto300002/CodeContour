import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/pull-request-gate.yml", "utf8");
const developmentRequirements = readFileSync("docs/development-requirements.md", "utf8");

describe("shared pull request CI gate", () => {
  it("runs for every pull request without file path filters", () => {
    expect(workflow).toMatch(/^  pull_request:\s*$/m);
    expect(workflow).not.toMatch(/^\s+paths:\s*$/m);
  });

  it.each(["npm test", "npm run typecheck", "npm run build:main", "npm run build:renderer"])(
    "runs %s on every pull request",
    (command) => {
      expect(workflow.split("\n")).toContain(`      - run: ${command}`);
    },
  );

  it("documents the checks that the workflow actually enforces", () => {
    for (const check of ["npm test", "npm run typecheck", "npm run build:main", "npm run build:renderer"]) {
      expect(developmentRequirements).toContain(check);
    }
    expect(developmentRequirements).not.toMatch(/^Lint Green\s*$/m);
  });
});
