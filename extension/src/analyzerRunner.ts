import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { AtlasGraph } from './types';

/** A failure with a message that is fit to show to the user as it is. */
export class AnalyzerError extends Error {}

// Keep in sync with Cli.cs in the analyzer.
const EXIT_NO_SDK = 2;

export function resolveAnalyzerDll(extensionPath: string): string {
  const configured = vscode.workspace
    .getConfiguration('dotnetAtlas')
    .get<string>('analyzerPath', '')
    .trim();

  return configured || path.join(extensionPath, 'analyzer', 'Atlas.Analyzer.dll');
}

export interface RunOptions {
  /** Solution or project file to analyze. */
  target: string;
  analyzerDll: string;
  dotnetPath: string;
  /** Receives the analyzer's progress and diagnostics. */
  output: vscode.OutputChannel;
  token?: vscode.CancellationToken;
}

/** Runs the analyzer and resolves with the parsed graph. Rejects with an AnalyzerError. */
export function runAnalyzer(options: RunOptions): Promise<AtlasGraph> {
  const { target, analyzerDll, dotnetPath, output, token } = options;

  return new Promise<AtlasGraph>((resolve, reject) => {
    if (!fs.existsSync(analyzerDll)) {
      reject(
        new AnalyzerError(
          `Analyzer not found at "${analyzerDll}". Build it with "npm run build:analyzer" in the extension folder, ` +
            'or set "dotnetAtlas.analyzerPath".',
        ),
      );
      return;
    }

    output.appendLine(`> ${dotnetPath} "${analyzerDll}" "${target}"`);

    const child = cp.spawn(dotnetPath, [analyzerDll, target], { windowsHide: true });
    const stdout: Buffer[] = [];
    let cancelled = false;

    token?.onCancellationRequested(() => {
      cancelled = true;
      child.kill();
    });

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => output.append(chunk.toString('utf8')));

    child.on('error', (error) => {
      reject(
        new AnalyzerError(
          `Could not start "${dotnetPath}": ${error.message}. Is the .NET SDK installed? ` +
            'You can set the path in "dotnetAtlas.dotnetPath".',
        ),
      );
    });

    child.on('close', (code) => {
      if (cancelled) {
        reject(new AnalyzerError('The analysis was cancelled.'));
        return;
      }

      if (code === EXIT_NO_SDK) {
        reject(new AnalyzerError('No usable .NET SDK was found. Install the .NET SDK and try again.'));
        return;
      }

      if (code !== 0) {
        reject(new AnalyzerError(`The analysis failed (exit code ${code}). See the "DotNet Solution Atlas" output for details.`));
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(stdout).toString('utf8')) as AtlasGraph);
      } catch (error) {
        reject(new AnalyzerError(`The analyzer returned invalid data: ${(error as Error).message}`));
      }
    });
  });
}
