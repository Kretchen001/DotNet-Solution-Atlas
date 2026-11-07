import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ACTIONS_VIEW_ID, ActionsViewProvider } from './actionsView';
import { AnalyzerError, resolveAnalyzerDll, runAnalyzer } from './analyzerRunner';
import { AtlasPanel } from './atlasPanel';
import { analyzeRevision, pickRevision, repositoryRoot } from './gitCompare';
import { pickTarget } from './targetPicker';
import type { AtlasGraph } from './types';

let output: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('DotNet Solution Atlas');

  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider(ACTIONS_VIEW_ID, new ActionsViewProvider()),
    vscode.commands.registerCommand('dotnetAtlas.openMap', () => openMap(context)),
    vscode.commands.registerCommand('dotnetAtlas.openSample', () => openSample(context)),
    vscode.commands.registerCommand('dotnetAtlas.compareWithGit', () => compareWithGit(context)),
    vscode.commands.registerCommand('dotnetAtlas.reloadMap', () => reloadMap(context)),
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

/** Analyzes the solution of the open map again, e.g. after files changed. */
async function reloadMap(context: vscode.ExtensionContext): Promise<void> {
  const target = AtlasPanel.currentTarget();
  if (!target || !path.isAbsolute(target)) {
    void vscode.window.showInformationMessage('DotNet Solution Atlas: open the map of a solution first.');
    return;
  }

  const graph = await analyze(context, target);
  if (graph) {
    AtlasPanel.show(context.extensionUri, graph);
  } else {
    AtlasPanel.reloadFailed();
  }
}

/** Compares the open map with the same solution in another Git revision. */
async function compareWithGit(context: vscode.ExtensionContext): Promise<void> {
  const channel = output!;
  const target = AtlasPanel.currentTarget();

  if (!target || !path.isAbsolute(target)) {
    void vscode.window.showInformationMessage('DotNet Solution Atlas: open the map of a solution first, then compare it.');
    return;
  }

  try {
    const revision = await pickRevision(await repositoryRoot(path.dirname(target)));
    if (!revision) {
      return;
    }

    const dotnetPath = vscode.workspace.getConfiguration('dotnetAtlas').get<string>('dotnetPath', 'dotnet');
    const baseline = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `DotNet Solution Atlas: analyzing ${revision.label}`,
        cancellable: true,
      },
      (progress, token) =>
        analyzeRevision({
          target,
          revision,
          analyzerDll: resolveAnalyzerDll(context.extensionPath),
          dotnetPath,
          output: channel,
          token,
          progress: (message) => progress.report({ message }),
          readXaml: vscode.workspace.getConfiguration('dotnetAtlas').get<boolean>('analyzeXaml', true),
        }),
    );

    AtlasPanel.showBaseline(revision.label, baseline);
  } catch (error) {
    if (error instanceof AnalyzerError) {
      void vscode.window.showErrorMessage(`DotNet Solution Atlas: ${error.message}`);
    } else {
      channel.appendLine(String(error));
      void vscode.window.showErrorMessage('DotNet Solution Atlas: unexpected error, see the output for details.');
    }
  }
}

/** Shows a small example map, so the view can be tried without a .NET solution or SDK. */
function openSample(context: vscode.ExtensionContext): void {
  const file = path.join(context.extensionPath, 'media', 'sample-graph.json');
  const graph = JSON.parse(fs.readFileSync(file, 'utf8')) as AtlasGraph;
  const rules = JSON.parse(fs.readFileSync(path.join(context.extensionPath, 'media', 'sample-rules.json'), 'utf8')) as unknown;
  AtlasPanel.show(context.extensionUri, graph, rules);
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
          readXaml: vscode.workspace.getConfiguration('dotnetAtlas').get<boolean>('analyzeXaml', true),
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
