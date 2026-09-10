import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { bundleExactHostLsp } from "./exact-release-bundle.mjs";

const extRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(extRoot, "..");

function main() {
	const result = bundleExactHostLsp({ extensionRoot: extRoot, repoRoot });
	console.log(`Bundled beskid_lsp ${result.version} to ${result.destination}`);
}

main();
