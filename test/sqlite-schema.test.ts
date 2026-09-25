import { getTableName } from "drizzle-orm";
import { expect, it } from "vitest";
import { analysisBatches, analysisRecords, analysisRuns, projects, snapshots } from "../src/sqlite-schema.js";

it("uses one Drizzle logical schema for both SQLite driver candidates", () => {
  expect([projects, snapshots, analysisRuns, analysisBatches, analysisRecords].map(getTableName)).toEqual([
    "project",
    "snapshot",
    "analysis_run",
    "analysis_batch",
    "analysis_record",
  ]);
});
