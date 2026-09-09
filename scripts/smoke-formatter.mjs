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

const sourceSettings = pkg?.contributes?.configurationDefaults?.["[beskid]"];
if (sourceSettings?.["editor.defaultFormatter"] !== "beskid.beskid-vscode") {
	throw new Error("expected [beskid] to use the Beskid formatter");
}
if (sourceSettings?.["editor.formatOnSave"] !== true) {
	throw new Error("expected [beskid] format-on-save to be enabled");
}

for (const language of ["[beskid]", "[beskid-manifest]", "[bsol]"]) {
	const settings = pkg?.contributes?.configurationDefaults?.[language];
	if (settings?.["editor.semanticHighlighting.enabled"] !== true) {
		throw new Error(`expected ${language} semantic highlighting to be enabled`);
	}
}

for (const language of ["[beskid-manifest]", "[bsol]"]) {
	const settings = pkg?.contributes?.configurationDefaults?.[language];
	if ("editor.defaultFormatter" in settings || "editor.formatOnSave" in settings) {
		throw new Error(`expected ${language} not to advertise unsupported formatting`);
	}
}

for (const pattern of ["**/*.bd", "**/*.bproj", "**/*.bws", "**/*.bsol"]) {
	if (!languageClientSource.includes(`pattern: \"${pattern}\"`)) {
		throw new Error(
			`expected language-client document selector to include ${pattern} files`,
		);
	}
}

console.log("formatter smoke check passed");
