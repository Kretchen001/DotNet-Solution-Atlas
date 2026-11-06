import * as path from 'node:path';
import * as vscode from 'vscode';

const EXCLUDE = '**/{node_modules,bin,obj,.git}/**';
const MAX_RESULTS = 50;

/**
 * Finds the solution (or, failing that, the project) to analyze in the open
 * folders. Asks the user to choose if there is more than one candidate.
 * Returns the absolute path, or undefined if nothing was found or chosen.
 */
export async function pickTarget(): Promise<string | undefined> {
  let candidates = await vscode.workspace.findFiles('**/*.{sln,slnx}', EXCLUDE, MAX_RESULTS);

  if (candidates.length === 0) {
    candidates = await vscode.workspace.findFiles('**/*.{csproj,vbproj}', EXCLUDE, MAX_RESULTS);
  }

  if (candidates.length === 0) {
    void vscode.window.showWarningMessage(
      'DotNet Solution Atlas: no solution (.sln, .slnx) or project (.csproj, .vbproj) found in the open folder.',
    );
    return undefined;
  }

  if (candidates.length === 1) {
    return candidates[0].fsPath;
  }

  const items = candidates
    .map((uri) => ({
      label: path.basename(uri.fsPath),
      description: vscode.workspace.asRelativePath(uri),
      uri,
    }))
    .sort((a, b) => a.description.localeCompare(b.description));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select the solution or project to map',
    matchOnDescription: true,
  });

  return picked?.uri.fsPath;
}
