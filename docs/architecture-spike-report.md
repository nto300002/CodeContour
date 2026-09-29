# Architecture Spike Report

## SQLite Driver (SPIKE-002)

Status: `GO` — source-level契約とmacOS arm64 packaged-app Gateは完了した。署名 / notarizationはMVP User Testおよび一般公開のRelease Gateとして管理する。

| Gate | Evidence | Current state |
| --- | --- | --- |
| Shared Driver / Drizzle Schema | `sqlite-driver-contract.test.ts`, `sqlite-schema.test.ts` | PASS |
| Migration / FK / WAL / rollback / recovery | both driver contract cases | PASS |
| Bulk insert / atomic promotion | `sqlite-snapshot-driver-contract.test.ts` | PASS |
| duplicate / cancelled / stale Batch rejection | `sqlite-snapshot-service.test.ts` | PASS |
| Main Single Writer | executor messageからDB capabilityを除外し、Gate後にのみMain DB ServiceがSQLiteへ保存 | `main-database-service.test.ts` | PASS |
| Candidate timing / DB size | `npm run measure:sqlite-driver` | PASS |
| Packaged macOS arm64 execution | [GitHub Actions Run 35961097858](https://github.com/nto300002/CodeContour/actions/runs/35961097858) | PASS |
| Main Event Loop heartbeat | 5 samples / p95 <= 100ms: better-sqlite3 26.49ms, node:sqlite 30.16ms | PASS |
| Signed distribution native-module load | MVP User Test / public release workflow | RELEASE GATE |

`docs/adr-002-sqlite-driver-measurements.json` contains only the comparable development measurement. The packaged smoke report is authoritative for package build duration, package size, Electron architecture, native module loading, and heartbeat delay.

The successful CI run used macOS 14 / arm64 / Node 24.20.0. Package build duration was 6,970ms and package size was 543,380,370 bytes. Both drivers completed all five packaged samples. `better-sqlite3` was loaded from the ASAR-unpacked packaged app.

The local Codex environment uses Node 26, where Forge can terminate without producing `out/`. The smoke writes a `FAILED` report rather than treating that case as success; the CI workflow fixes Node 24 and macOS 14 / arm64 for reproducible target evidence.

## Acceptance transition

ADR-002のDriver選定は`GO / ACCEPTED`である。署名・notarizationは、MVP User TestまたはGitHub Releasesで一般公開する前に実施・検証するRelease Gateである。未署名配布は開発・自分用Buildと、Gatekeeper警告を許容するPoC技術者向け一時配布に限定する。
