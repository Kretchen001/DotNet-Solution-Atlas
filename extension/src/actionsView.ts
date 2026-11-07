import * as vscode from 'vscode';

/** One clickable entry in the Activity Bar view. */
interface Action {
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly command: string;
}

const ACTIONS: readonly Action[] = [
  {
    label: 'Open map of the solution',
    description: 'analyze the open .NET solution',
    icon: 'type-hierarchy',
    command: 'dotnetAtlas.openMap',
  },
  {
    label: 'Open sample map',
    description: 'no .NET SDK needed',
    icon: 'beaker',
    command: 'dotnetAtlas.openSample',
  },
];

/** The id of the view contributed in package.json. */
export const ACTIONS_VIEW_ID = 'dotnetAtlas.actions';

/** Lists the extension's commands in the side bar, so they are reachable without the command palette. */
export class ActionsViewProvider implements vscode.TreeDataProvider<Action> {
  getTreeItem(action: Action): vscode.TreeItem {
    const item = new vscode.TreeItem(action.label, vscode.TreeItemCollapsibleState.None);
    item.description = action.description;
    item.iconPath = new vscode.ThemeIcon(action.icon);
    item.command = { command: action.command, title: action.label };
    item.tooltip = `${action.label} (${action.description})`;
    return item;
  }

  getChildren(element?: Action): Action[] {
    return element ? [] : [...ACTIONS];
  }
}
