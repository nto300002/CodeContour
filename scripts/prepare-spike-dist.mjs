import { mkdir, writeFile } from "node:fs/promises";
const output = "/private/tmp/codecontour-spike-dist";
await mkdir(output, { recursive: true });
await writeFile(`${output}/package.json`, '{"type":"module"}\n');
