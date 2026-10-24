import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2] ?? "bun.lock";
const PRIVATE = /https:\/\/[a-z0-9-]+-npm\.pkg\.dev\/lovable-core-prod\/sandbox-npm-cache\//g;

const before = readFileSync(file, "utf8");
const count = (before.match(PRIVATE) ?? []).length;
if (count > 0) writeFileSync(file, before.replace(PRIVATE, "https://registry.npmjs.org/"));
console.log(`normalize-bun-lock: rewrote ${count} private-mirror URL(s) in ${file}`);
