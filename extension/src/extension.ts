import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('dotnetAtlas.openMap', () => {
      void vscode.window.showInformationMessage('DotNet Solution Atlas: analysis is not implemented yet.');
    }),
    vscode.commands.registerCommand('dotnetAtlas.openSample', () => {
      void vscode.window.showInformationMessage('DotNet Solution Atlas: sample map is not implemented yet.');
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up: everything is registered in context.subscriptions.
}
