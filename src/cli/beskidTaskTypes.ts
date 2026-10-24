import { type BeskidCliOperation, cliOperationLabel } from "./cliCommandSurface.js";

/** Task type to CLI operation. Each task provider serves exactly one of these types. */
export const BESKID_TASK_TYPES: Record<string, BeskidCliOperation> = {
	"beskid-fetch": "fetch",
	"beskid-lock": "lock",
	"beskid-build": "build",
	"beskid-test": "test",
	"beskid-check": "check",
};

export type BeskidTaskSpec = {
	definition: { type: string; projectPath: string };
	operation: BeskidCliOperation;
	name: string;
};

/**
 * The tasks a provider registered for `type` offers: only that type. VS Code
 * rejects a provider that returns a task of another type.
 */
export function taskSpecsForType(
	type: string,
	projectPath: string,
): BeskidTaskSpec[] {
	const operation = BESKID_TASK_TYPES[type];
	if (!operation) {
		return [];
	}
	return [
		{
			definition: { type, projectPath },
			operation,
			name: `Beskid ${cliOperationLabel(operation)}`,
		},
	];
}

/** True when a task of `taskType` may be returned by the provider registered for `providerType`. */
export function taskBelongsToProvider(
	providerType: string,
	taskType: string | undefined,
): boolean {
	return taskType === providerType && providerType in BESKID_TASK_TYPES;
}
