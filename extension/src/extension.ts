import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AnalyzerError, resolveAnalyzerDll, runAnalyzer } from './analyzerRunner';
import { AtlasPanel } from './atlasPanel';
import { pickTarget } from './targetPicker';
import type { AtlasGraph } from './types';

let output: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('DotNet Solution Atlas');

  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('dotnetAtlas.openMap', () => openMap(context)),
    vscode.commands.registerCommand('dotnetAtlas.openSample', () => openSample(context)),
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

  AtlasPanel.show(context.extensionUri, graph);
}

/** Shows a small example map, so the view can be tried without a .NET solution or SDK. */
function openSample(context: vscode.ExtensionContext): void {
  const file = path.join(context.extensionPath, 'media', 'sample-graph.json');
  const graph = JSON.parse(fs.readFileSync(file, 'utf8')) as AtlasGraph;
  AtlasPanel.show(context.extensionUri, graph);
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
