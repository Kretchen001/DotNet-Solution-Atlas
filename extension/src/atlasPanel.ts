import { randomBytes } from 'node:crypto';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { AtlasGraph } from './types';

/** Messages the webview (media/main.js) sends to the extension. */
interface WebviewMessage {
  type?: string;
  file?: unknown;
  line?: unknown;
}

/**
 * The map: a single webview panel that shows a graph. Showing another graph
 * reuses the open panel instead of opening a second one.
 */
export class AtlasPanel {
  private static current: AtlasPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private graph: AtlasGraph;
  /** Files the webview may ask to open: only those that belong to the graph. */
  private files = new Set<string>();

  static show(extensionUri: vscode.Uri, graph: AtlasGraph): void {
    if (AtlasPanel.current) {
      AtlasPanel.current.update(graph);
      AtlasPanel.current.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel('dotnetAtlas.map', 'DotNet Solution Atlas', vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'media'),
        vscode.Uri.joinPath(extensionUri, 'node_modules', 'cytoscape', 'dist'),
        vscode.Uri.joinPath(extensionUri, 'node_modules', 'cytoscape-dagre'),
        vscode.Uri.joinPath(extensionUri, 'node_modules', 'dagre', 'dist'),
      ],
    });

    AtlasPanel.current = new AtlasPanel(panel, extensionUri, graph);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    graph: AtlasGraph,
  ) {
    this.graph = graph;
    this.remember(graph);

    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage((message: WebviewMessage) => this.onMessage(message), undefined, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  private update(graph: AtlasGraph): void {
    this.graph = graph;
    this.remember(graph);
    void this.panel.webview.postMessage({ type: 'graph', graph, settings: this.settings() });
  }

  private settings(): { zoomSpeed: number } {
    return { zoomSpeed: vscode.workspace.getConfiguration('dotnetAtlas').get<number>('zoomSpeed', 1) };
  }

  private remember(graph: AtlasGraph): void {
    this.files = new Set(graph.nodes.flatMap((node) => (node.file ? [node.file] : [])));
    this.panel.title = `Atlas: ${path.basename(graph.root)}`;
  }

  private onMessage(message: WebviewMessage): void {
    switch (message.type) {
      // The script in the webview is loaded and waits for data.
      case 'ready':
        void this.panel.webview.postMessage({ type: 'graph', graph: this.graph, settings: this.settings() });
        break;

      case 'open':
        void this.openFile(message.file, message.line);
        break;
    }
  }

  private async openFile(file: unknown, line: unknown): Promise<void> {
    // The webview is untrusted input: only open files that the analysis reported.
    if (typeof file !== 'string' || !this.files.has(file)) {
      return;
    }

    const lineIndex = typeof line === 'number' && line > 0 ? line - 1 : 0;
    const position = new vscode.Position(lineIndex, 0);
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));

    // Beside the map, so the map keeps its tab and its place.
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Beside,
      selection: new vscode.Range(position, position),
    });
  }

  private html(): string {
    const webview = this.panel.webview;
    const asset = (...segments: string[]) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...segments)).toString();
    const nonce = randomBytes(16).toString('hex');

    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
    ].join('; ');

    // Order matters: dagre and cytoscape have to be loaded before the layout plugin registers itself.
    const scripts = [
      asset('node_modules', 'dagre', 'dist', 'dagre.min.js'),
      asset('node_modules', 'cytoscape', 'dist', 'cytoscape.min.js'),
      asset('node_modules', 'cytoscape-dagre', 'cytoscape-dagre.js'),
      asset('media', 'main.js'),
    ]
      .map((src) => `<script nonce="${nonce}" src="${src}"></script>`)
      .join('\n    ');

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${asset('media', 'main.css')}">
    <title>DotNet Solution Atlas</title>
  </head>
  <body>
    <div id="app">
      <aside id="filters" aria-label="Filters">
        <h3>Relationships</h3>
        <div id="edgeKinds"></div>
        <h3>Types</h3>
        <div id="kinds"></div>
        <h3 id="languagesHeading" hidden>Languages</h3>
        <div id="languages"></div>
        <h3>Projects</h3>
        <div id="projects"></div>
        <h3>Groups</h3>
        <div id="groups"></div>
      </aside>
      <main>
        <div id="toolbar">
          <span id="root"></span>
          <input id="search" type="search" placeholder="Search types" aria-label="Search types">
          <label class="check"><input id="focus" type="checkbox"> Focus on selection</label>
          <label class="check"><input id="namespaces" type="checkbox"> Group by namespace</label>
          <button id="fit" type="button">Fit</button>
          <button id="relayout" type="button">Re-layout</button>
        </div>
        <div id="cy" role="img" aria-label="Dependency map of the solution"></div>
        <div id="empty" hidden>No types found.</div>
      </main>
      <aside id="details" aria-live="polite"></aside>
    </div>
    ${scripts}
  </body>
</html>`;
  }

  private dispose(): void {
    AtlasPanel.current = undefined;
    this.panel.dispose();
    this.disposables.splice(0).forEach((d) => d.dispose());
  }
}
