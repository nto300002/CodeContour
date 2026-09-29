import electron from "electron";
import { execFileSync, spawn } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform !== "darwin") throw new Error("Electron app smoke requires macOS, the MVP target OS.");
const temporaryRoot = await mkdtemp(join(tmpdir(), "codecontour-electron-smoke-"));
const repositoryRoot = join(temporaryRoot, "repository");
const userDataPath = join(temporaryRoot, "user-data");
const configPath = join(temporaryRoot, "config.json");
const reportPath = join(temporaryRoot, "stage-result.json");
const entry = resolve("scripts/electron-app-smoke-main.cjs");
const expectedProjectId = "smoke-project";

async function runStage(stage) {
  await writeFile(configPath, JSON.stringify({ stage, repositoryRoot, userDataPath, reportPath, projectId: expectedProjectId }));
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(electron, [entry], {
      cwd: process.cwd(),
      env: { ...process.env, CODECONTOUR_APP_SMOKE_CONFIG: configPath },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const collect = (chunk) => { output = (output + chunk.toString()).slice(-16000); };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timeout = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`${stage} timed out. ${output}`)); }, 90000);
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("exit", (code, signal) => { clearTimeout(timeout); resolveResult({ code, signal, output }); });
  });
  if (result.code !== 0) throw new Error(`${stage} Electron exit=${result.code} signal=${result.signal}\n${result.output}`);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (report.status !== "PASS" || report.stage !== stage) throw new Error(`${stage} reported ${JSON.stringify(report)}`);
  process.stdout.write(`${stage}: ${JSON.stringify(report.checks)}\n`);
}

try {
  await cp(resolve("test/fixtures/basic"), repositoryRoot, { recursive: true });
  await writeFile(join(repositoryRoot, "src", "index.ts"), "export function answer(): number { return 42; }\n");
  execFileSync("git", ["init", "-q", repositoryRoot]);
  await mkdir(userDataPath);
  await runStage("initial");
  await runStage("restart-and-failure");
  process.stdout.write("Electron app smoke passed.\n");
} finally {
  if (process.env.CODECONTOUR_KEEP_SMOKE_DATA === "1") process.stdout.write(`Smoke data: ${temporaryRoot}\n`);
  else await rm(temporaryRoot, { recursive: true, force: true });
}
