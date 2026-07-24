import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const LEGACY_MANIFEST_PATTERNS = ["Project.proj", "Workspace.proj"] as const;

function collectSourceFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		const stat = statSync(path);
		if (stat.isDirectory()) {
			files.push(...collectSourceFiles(path));
			continue;
		}
		if (path.endsWith(".ts")) {
			files.push(path);
		}
	}
	return files;
}

describe("BSOL manifest contract", () => {
	test("src/ does not reference legacy Project.proj or Workspace.proj manifests", () => {
		const srcRoot = join(import.meta.dir, "../src");
		const offenders: string[] = [];

		for (const file of collectSourceFiles(srcRoot)) {
			const source = readFileSync(file, "utf8");
			for (const pattern of LEGACY_MANIFEST_PATTERNS) {
				if (source.includes(pattern)) {
					offenders.push(`${file.replace(`${srcRoot}/`, "src/")} (${pattern})`);
				}
			}
		}

		expect(offenders).toEqual([]);
	});
});
