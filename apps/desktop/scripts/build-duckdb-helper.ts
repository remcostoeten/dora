import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    cwd: join(import.meta.dir, "..", "src-tauri"),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function hostTriple(): string {
  const output = run("rustc", ["-vV"]);
  const hostLine = output
    .split("\n")
    .find((line) => line.startsWith("host: "));
  if (!hostLine) {
    throw new Error("Could not determine Rust host target triple");
  }
  return hostLine.slice("host: ".length).trim();
}

const target = process.env.TARGET || process.env.CARGO_BUILD_TARGET || hostTriple();
const isWindows = target.includes("windows");
const exe = isWindows ? ".exe" : "";
const binariesDir = join(import.meta.dir, "..", "src-tauri", "binaries");
const dest = join(binariesDir, `duckdb_helper-${target}${exe}`);

mkdirSync(binariesDir, { recursive: true });
if (!existsSync(dest)) {
  writeFileSync(dest, "");
}

const cargoArgs = [
  "build",
  "--release",
  "--bin",
  "duckdb_helper",
  "--features",
  "duckdb-engine",
];

if (target !== hostTriple()) {
  cargoArgs.push("--target", target);
}

run("cargo", cargoArgs);

const releaseDir =
  target === hostTriple()
    ? join("target", "release")
    : join("target", target, "release");
const source = join(import.meta.dir, "..", "src-tauri", releaseDir, `duckdb_helper${exe}`);
if (!existsSync(source)) {
  throw new Error(`Expected helper binary missing at ${source}`);
}

copyFileSync(source, dest);

console.log(`Copied ${basename(source)} to ${dest}`);
