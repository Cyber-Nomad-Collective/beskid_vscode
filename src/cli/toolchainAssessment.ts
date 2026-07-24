export type ToolchainAssessment = {
	requiresBootstrap: boolean;
	downloading: boolean;
	cliMissing: boolean;
	cliNeedsUpgrade: boolean;
	lspMissing: boolean;
	needsFetch: boolean;
};

export function onboardingProgressMessage(
	assessment: ToolchainAssessment,
): string {
	if (assessment.downloading && assessment.needsFetch) {
		return "Downloading Beskid CLI and language server, then preparing workspace…";
	}
	if (assessment.downloading) {
		return "Downloading Beskid CLI and language server…";
	}
	if (assessment.needsFetch) {
		return "Preparing workspace dependencies…";
	}
	return "Setting up Beskid toolchain…";
}
