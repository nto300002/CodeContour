// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProcessDataFlowCanvas, ProcessDataFlowInspector, type FlowData, type FlowProcess } from "../src/renderer/process-data-flow.js";

afterEach(cleanup);

const feature = { id: "feature-auth", label: "Authentication" };
const processes: readonly FlowProcess[] = [
  { id: "process-login", featureId: feature.id, name: "Login", order: 0, lifecycle: "ACTIVE", codeRefCount: 1, inputs: ["credentials"], outputs: ["token"] },
  { id: "process-session", featureId: feature.id, name: "Create session", order: 1, lifecycle: "ACTIVE", codeRefCount: 0, inputs: ["token"], outputs: ["session"] },
];
const flows: readonly FlowData[] = [{ id: "flow-login-session", featureId: feature.id, fromProcessId: "process-login", toProcessId: "process-session", label: "credentials → session", verification: "EVIDENCED", freshness: "STALE", evidence: [{ symbolId: "symbol:validate-token", name: "validateToken", qualifiedName: "validateToken", relativePath: "src/auth.ts", range: { start: 10, end: 23 } }] }];

describe("Process / Data Flow projection", () => {
  it("renders selected Feature processes, flows, and their independent states", () => {
    render(<ProcessDataFlowCanvas feature={feature} flows={flows} onCreateFlow={vi.fn()} onCreateProcess={vi.fn()} onMoveProcess={vi.fn()} onSelectFlow={vi.fn()} onSelectProcess={vi.fn()} processes={processes} selectedFlowId={undefined} selectedProcessId={undefined} />);

    expect(screen.getByRole("article", { name: "Process: Login" }).textContent).toContain("Code refs: 1");
    expect(screen.getByRole("article", { name: "Data flow: credentials → session" }).textContent).toContain("Verification: EVIDENCED");
    expect(screen.getByRole("article", { name: "Data flow: credentials → session" }).textContent).toContain("Freshness: STALE");
  });

  it("projects related code, data, and evidence into the Inspector", () => {
    render(<ProcessDataFlowInspector feature={feature} flow={flows[0]} onAddEvidence={vi.fn()} onDeleteFlow={vi.fn()} onDeleteProcess={vi.fn()} onRenameFlow={vi.fn()} onRenameProcess={vi.fn()} onUpdateFlowEndpoints={vi.fn()} process={processes[0]} processes={processes} symbols={[]} />);

    const inspector = screen.getByLabelText("Process / Data Flow inspector");
    expect(inspector.textContent).toContain("Code refs: 1");
    expect(inspector.textContent).toContain("Inputs: credentials");
    expect(inspector.textContent).toContain("Outputs: token");
    expect(inspector.textContent).toContain("Evidence: validateToken (src/auth.ts:10-23)");
  });
});
