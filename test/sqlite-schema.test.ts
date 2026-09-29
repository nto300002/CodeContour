import { getTableName } from "drizzle-orm";
import { expect, it } from "vitest";
import { analysisBatches, analysisRecords, analysisRuns, dataFlowEvidence, dataFlows, features, processSteps, processSymbolLinks, processes, projects, repositorySettings, snapshots } from "../src/sqlite-schema.js";

it("uses one Drizzle logical schema for both SQLite driver candidates", () => {
  expect([projects, snapshots, analysisRuns, analysisBatches, analysisRecords, repositorySettings, features, processes, processSteps, processSymbolLinks, dataFlows, dataFlowEvidence].map(getTableName)).toEqual([
    "project",
    "snapshot",
    "analysis_run",
    "analysis_batch",
    "analysis_record",
    "project_repository",
    "feature",
    "process",
    "process_step",
    "process_symbol_link",
    "data_flow",
    "data_flow_evidence",
  ]);
});
