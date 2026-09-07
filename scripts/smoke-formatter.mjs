import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const languageClientSource = readFileSync(
	join(root, "src", "lsp", "beskidLanguageClient.ts"),
	"utf8",
);

for (const language of ["[beskid]", "[beskid-manifest]"]) {
	const settings = pkg?.contributes?.configurationDefaults?.[language];
	if (settings?.["editor.defaultFormatter"] !== "beskid.beskid-vscode") {
		throw new Error(
			`expected ${language} editor.defaultFormatter to be 'beskid.beskid-vscode', got ${String(settings?.["editor.defaultFormatter"])}`,
		);
	}

	if (settings?.["editor.formatOnSave"] !== true) {
		throw new Error(
			`expected ${language} editor.formatOnSave to be true, got ${String(settings?.["editor.formatOnSave"])}`,
		);
	}
}

for (const pattern of ["**/*.bd", "**/*.bproj", "**/*.bws"]) {
	if (!languageClientSource.includes(`pattern: \"${pattern}\"`)) {
		throw new Error(
			`expected language-client document selector to include ${pattern} files`,
		);
	}
}

console.log("formatter smoke check passed");
