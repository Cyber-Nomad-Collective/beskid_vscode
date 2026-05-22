export type PckgActivityPhase = "search" | "details" | "fetch" | "lock";

export type CliActivityPhase = "build" | "test" | "analyze";

export type BeskidActivityPhase = PckgActivityPhase | CliActivityPhase | "fetch" | "lock";

export type PckgActivityReporter = (
  phase: BeskidActivityPhase,
  active: boolean,
  detail?: string,
) => void;
