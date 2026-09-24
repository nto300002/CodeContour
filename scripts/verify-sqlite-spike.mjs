import { readFile } from "node:fs/promises";

const [measurementPath = "docs/adr-002-sqlite-driver-measurements.json", smokePath = "docs/adr-002-sqlite-packaged-smoke.json"] = process.argv.slice(2);
const measurement = JSON.parse(await readFile(measurementPath, "utf8"));
const smoke = JSON.parse(await readFile(smokePath, "utf8"));

if (measurement.status !== "COMPLETE" || measurement.candidates?.length !== 2) throw new Error("SQLite driver measurement is incomplete");
if (new Set(measurement.candidates.map((candidate) => candidate.driver)).size !== 2) throw new Error("Both SQLite candidates must be measured");
if (smoke.status !== "COMPLETE" || smoke.candidates?.length !== 2) throw new Error("Packaged SQLite smoke is incomplete");
for (const candidate of smoke.candidates) {
  if (candidate.status !== "COMPLETE" || candidate.samples?.length !== smoke.heartbeatSampleCount) throw new Error(`Packaged ${candidate.driver} smoke is incomplete`);
  if (candidate.samples.some((sample) => sample.smoke?.driver !== candidate.driver || sample.smoke?.value !== "ok")) throw new Error(`Packaged ${candidate.driver} returned an invalid smoke result`);
  if (typeof candidate.mainEventLoopP95Ms !== "number" || candidate.mainEventLoopP95Ms > 100) throw new Error(`Packaged ${candidate.driver} exceeded the 100ms Main Event Loop delay threshold`);
}
if (typeof smoke.packageBytes !== "number" || smoke.packageBytes <= 0 || typeof smoke.packagingElapsedMs !== "number" || smoke.packagingElapsedMs <= 0) throw new Error("Packaged SQLite size or duration is missing");
process.stdout.write("SQLite driver spike reports verified.\n");
