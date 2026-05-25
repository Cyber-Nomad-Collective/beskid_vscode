import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function probeCliVersion(cliPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(cliPath, ["--version"], {
      timeout: 10_000,
      windowsHide: true,
    });
    const line = stdout.trim().split(/\r?\n/)[0]?.trim();
    return line || undefined;
  } catch {
    return undefined;
  }
}
