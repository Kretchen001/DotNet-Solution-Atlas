import * as vscode from 'vscode';
import { AnalyzerError, resolveAnalyzerDll, runAnalyzer } from './analyzerRunner';
import { pickTarget } from './targetPicker';
import type { AtlasGraph } from './types';

let output: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('DotNet Solution Atlas');

  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('dotnetAtlas.openMap', () => openMap(context)),
    vscode.commands.registerCommand('dotnetAtlas.openSample', () => {
      void vscode.window.showInformationMessage('DotNet Solution Atlas: sample map is not implemented yet.');
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up: everything is registered in context.subscriptions.
}

async function openMap(context: vscode.ExtensionContext): Promise<void> {
  const target = await pickTarget();
  if (!target) {
    return;
  }

  const graph = await analyze(context, target);
  if (!graph) {
    return;
  }

  // The map itself follows in a later step; for now report what was found.
  void vscode.window.showInformationMessage(
    `DotNet Solution Atlas: found ${graph.nodes.length} types and ${graph.edges.length} relationships.`,
  );
}

async function analyze(context: vscode.ExtensionContext, target: string): Promise<AtlasGraph | undefined> {
  const channel = output!;
  const dotnetPath = vscode.workspace.getConfiguration('dotnetAtlas').get<string>('dotnetPath', 'dotnet');

  try {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'DotNet Solution Atlas: analyzing solution',
        cancellable: true,
      },
      (_progress, token) =>
        runAnalyzer({
          target,
          analyzerDll: resolveAnalyzerDll(context.extensionPath),
          dotnetPath,
          output: channel,
          token,
        }),
    );
  } catch (error) {
    if (error instanceof AnalyzerError) {
      void vscode.window.showErrorMessage(`DotNet Solution Atlas: ${error.message}`);
    } else {
      channel.appendLine(String(error));
      void vscode.window.showErrorMessage('DotNet Solution Atlas: unexpected error, see the output for details.');
    }

    return undefined;
  }
}
