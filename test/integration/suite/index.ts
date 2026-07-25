import { globSync } from "glob";
import Mocha from "mocha";

export async function run(): Promise<void> {
	const suiteDir = __dirname;
	const mocha = new Mocha({ ui: "tdd", timeout: 60_000 });

	for (const file of globSync("**/*.integration.test.js", {
		cwd: suiteDir,
		absolute: true,
	})) {
		mocha.addFile(file);
	}

	return new Promise((resolve, reject) => {
		mocha.run((failures) => {
			if (failures > 0) {
				reject(new Error(`${failures} integration test(s) failed.`));
				return;
			}
			resolve();
		});
	});
}
