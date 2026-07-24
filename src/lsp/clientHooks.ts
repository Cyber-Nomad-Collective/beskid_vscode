import type { LanguageClientOptions } from "vscode-languageclient/node";

export type BeskidClientHooks = {
	onRefreshWorkspaceUi?: () => Promise<void>;
};

export function buildExecuteCommandMiddleware(
	hooks: BeskidClientHooks | undefined,
): NonNullable<LanguageClientOptions["middleware"]> {
	return {
		executeCommand: async (command, args, next) => {
			const result = await next(command, args);
			if (command === "beskid.refreshWorkspace") {
				await hooks?.onRefreshWorkspaceUi?.();
			}
			return result;
		},
	};
}
