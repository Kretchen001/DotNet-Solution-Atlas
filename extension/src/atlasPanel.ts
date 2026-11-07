import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { AtlasGraph } from './types';

/** Messages the webview (media/main.js) sends to the extension. */
interface WebviewMessage {
  type?: string;
  file?: unknown;
  line?: unknown;
  format?: unknown;
  /** Text of a text format, or the base64 data of an image. */
  content?: unknown;
}

/** What the map can be saved as. The webview is untrusted, so only these formats and file types are written. */
const EXPORT_FORMATS: Record<string, { label: string; extension: string; binary: boolean }> = {
  png: { label: 'PNG image', extension: 'png', binary: true },
  svg: { label: 'SVG image', extension: 'svg', binary: false },
  mermaid: { label: 'Mermaid diagram', extension: 'mmd', binary: false },
  dot: { label: 'Graphviz DOT', extension: 'dot', binary: false },
  json: { label: 'JSON', extension: 'json', binary: false },
};

const MAX_EXPORT_BYTES = 64 * 1024 * 1024;

/** The architecture rules file as the webview gets it: its content, or what went wrong. */
interface RulesPayload {
  file?: string;
  data?: unknown;
  error?: string;
  /** True for the rules that ship with the sample map: there is no file to edit. */
  sample?: boolean;
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
  /** Rules that come with the sample map instead of a file. */
  private sampleRules: unknown;

  /** The solution or project file of the map that is open, if any. */
  static currentTarget(): string | undefined {
    return AtlasPanel.current?.graph.root;
  }

  /** Marks what changed since an earlier revision in the open map. */
  static showBaseline(label: string, baseline: AtlasGraph): void {
    const panel = AtlasPanel.current;
    if (!panel) {
      return;
    }

    // Only what the comparison needs: no paths of the temporary checkout, no member details.
    const slim: AtlasGraph = {
      root: baseline.root,
      nodes: baseline.nodes.map(({ memberDetails: _members, file: _file, ...node }) => node),
      edges: baseline.edges,
    };

    panel.panel.reveal();
    void panel.panel.webview.postMessage({ type: 'baseline', label, graph: slim });
  }

  static show(extensionUri: vscode.Uri, graph: AtlasGraph, sampleRules?: unknown): void {
    if (AtlasPanel.current) {
      AtlasPanel.current.update(graph, sampleRules);
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

    AtlasPanel.current = new AtlasPanel(panel, extensionUri, graph, sampleRules);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    graph: AtlasGraph,
    sampleRules?: unknown,
  ) {
    this.graph = graph;
    this.sampleRules = sampleRules;
    this.remember(graph);

    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage((message: WebviewMessage) => this.onMessage(message), undefined, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  private update(graph: AtlasGraph, sampleRules?: unknown): void {
    this.graph = graph;
    this.sampleRules = sampleRules;
    this.remember(graph);
    this.sendGraph();
  }

  private sendGraph(): void {
    void this.panel.webview.postMessage({
      type: 'graph',
      graph: this.graph,
      settings: this.settings(),
      rules: this.loadRules() ?? {},
    });
  }

  /** Where the rules file is looked for: next to the analyzed solution first, then in the workspace folders. */
  private rulesDirectories(): string[] {
    const directories: string[] = [];
    if (path.isAbsolute(this.graph.root)) {
      directories.push(path.dirname(this.graph.root));
    }
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      directories.push(folder.uri.fsPath);
    }
    return directories;
  }

  private rulesFileName(): string {
    return vscode.workspace.getConfiguration('dotnetAtlas').get<string>('rulesFile', '.atlas.json') || '.atlas.json';
  }

  private loadRules(): RulesPayload | undefined {
    if (this.sampleRules !== undefined) {
      return { file: 'Rules of the sample map', data: this.sampleRules, sample: true };
    }

    for (const directory of this.rulesDirectories()) {
      const file = path.resolve(directory, this.rulesFileName());
      if (!fs.existsSync(file)) {
        continue;
      }

      try {
        return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) as unknown };
      } catch (error) {
        return { file, error: `${path.basename(file)}: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    return undefined;
  }

  /** Creates a rules file with an example next to the solution, or opens the one that exists. */
  private async createRules(): Promise<void> {
    // The sample has no file; look for (or create) a real one.
    const existing = this.sampleRules === undefined ? this.loadRules() : undefined;
    const directory = this.rulesDirectories()[0];
    if (!existing && !directory) {
      void vscode.window.showWarningMessage('DotNet Solution Atlas: open a folder first, so there is a place for the rules file.');
      return;
    }

    const file = existing?.file ?? path.resolve(directory, this.rulesFileName());
    if (!existing) {
      fs.writeFileSync(file, this.rulesTemplate(), 'utf8');
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside });
  }

  /** An example with the usual layers, using the namespace prefix most types of the solution have. */
  private rulesTemplate(): string {
    const counts = new Map<string, number>();
    for (const node of this.graph.nodes) {
      const first = node.namespace.split('.')[0];
      if (first) {
        counts.set(first, (counts.get(first) ?? 0) + 1);
      }
    }
    const prefix = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'MyApp';

    const template = {
      layers: [
        { name: 'Domain', namespaces: [`${prefix}.Domain*`] },
        { name: 'Application', namespaces: [`${prefix}.Application*`] },
        { name: 'Infrastructure', namespaces: [`${prefix}.Infrastructure*`] },
      ],
      rules: [
        { from: 'Domain', canOnlyUse: [] },
        { from: 'Application', canOnlyUse: ['Domain'] },
      ],
    };
    return JSON.stringify(template, null, 2) + '\n';
  }

  private settings(): { zoomSpeed: number; namespaceGrouping: string } {
    const config = vscode.workspace.getConfiguration('dotnetAtlas');
    return {
      zoomSpeed: config.get<number>('zoomSpeed', 1),
      namespaceGrouping: config.get<string>('namespaceGrouping', 'off'),
    };
  }

  private remember(graph: AtlasGraph): void {
    this.files = new Set(
      graph.nodes.flatMap((node) => [
        ...(node.file ? [node.file] : []),
        ...(node.memberDetails ?? []).flatMap((member) => (member.file ? [member.file] : [])),
      ]),
    );
    this.panel.title = `Atlas: ${path.basename(graph.root)}`;
  }

  private onMessage(message: WebviewMessage): void {
    switch (message.type) {
      // The script in the webview is loaded and waits for data.
      case 'ready':
        this.sendGraph();
        break;

      case 'reloadRules':
        void this.panel.webview.postMessage({ type: 'rules', rules: this.loadRules() ?? {} });
        break;

      case 'createRules':
        void this.createRules();
        break;

      case 'open':
        void this.openFile(message.file, message.line);
        break;

      case 'compare':
        void vscode.commands.executeCommand('dotnetAtlas.compareWithGit');
        break;

      case 'save':
        void this.saveExport(message.format, message.content);
        break;
    }
  }

  /** Asks where to save and writes what the webview exported. */
  private async saveExport(format: unknown, content: unknown): Promise<void> {
    const spec = typeof format === 'string' && Object.hasOwn(EXPORT_FORMATS, format) ? EXPORT_FORMATS[format] : undefined;
    if (!spec || typeof content !== 'string') {
      return;
    }

    const bytes = spec.binary ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
    if (bytes.length === 0 || bytes.length > MAX_EXPORT_BYTES) {
      void vscode.window.showErrorMessage(`The ${spec.label} is empty or too large to save.`);
      return;
    }

    const solution = path.isAbsolute(this.graph.root) ? path.basename(this.graph.root, path.extname(this.graph.root)) : 'solution';
    const folder = path.isAbsolute(this.graph.root)
      ? path.dirname(this.graph.root)
      : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const name = `${solution}-map.${spec.extension}`;

    const target = await vscode.window.showSaveDialog({
      defaultUri: folder ? vscode.Uri.file(path.join(folder, name)) : undefined,
      filters: { [spec.label]: [spec.extension] },
      saveLabel: 'Export',
    });
    if (!target) {
      return;
    }

    try {
      await vscode.workspace.fs.writeFile(target, bytes);
    } catch (error) {
      void vscode.window.showErrorMessage(`The map could not be saved: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const open = 'Open';
    const choice = await vscode.window.showInformationMessage(`Saved ${path.basename(target.fsPath)}.`, open);
    if (choice === open) {
      await vscode.commands.executeCommand('vscode.open', target);
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
      asset('media', 'atlasLogic.js'),
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
        <h3>Analysis</h3>
        <label class="field">Node size
          <select id="sizeBy" aria-label="What the height of a node shows">
            <option value="uniform">Uniform</option>
            <option value="coupling">Coupling</option>
            <option value="fanIn">Used by others</option>
            <option value="lines">Lines</option>
          </select>
        </label>
        <label class="check"><input id="markCycles" type="checkbox" checked> Mark cycles</label>
        <label class="check"><input id="showViolations" type="checkbox" checked> Mark rule violations</label>
        <details id="changesBox" hidden>
          <summary>Changes <span id="changeCount" class="badge"></span></summary>
          <div id="changes"></div>
        </details>
        <details>
          <summary>Cycles <span id="cycleCount" class="badge"></span></summary>
          <div id="cycles"></div>
        </details>
        <details>
          <summary>Hubs</summary>
          <select id="hubMetric" aria-label="Ranking of the hubs"></select>
          <div id="hubs"></div>
        </details>
        <details>
          <summary>Unused candidates <span id="unusedCount" class="badge"></span></summary>
          <div id="unused"></div>
        </details>
        <details>
          <summary>Architecture rules <span id="ruleCount" class="badge"></span></summary>
          <div id="rules"></div>
        </details>
      </aside>
      <main>
        <div id="toolbar">
          <span id="root"></span>
          <input id="search" type="search" placeholder="Search types" aria-label="Search types">
          <label class="check"><input id="focus" type="checkbox"> Focus on selection</label>
          <label class="check">Namespaces
            <select id="namespaces" aria-label="Show namespaces as frames">
              <option value="off">Off</option>
              <option value="grouped">Grouped</option>
              <option value="nested">Nested</option>
            </select>
          </label>
          <label class="check">Collapse
            <select id="collapse" aria-label="Collapse namespaces or projects into one node">
              <option value="none">Off</option>
              <option value="namespace">Namespaces</option>
              <option value="project">Projects</option>
            </select>
          </label>
          <label class="check">
            <select id="export" aria-label="Export the map shown">
              <option value="">Export…</option>
              <option value="png">PNG image</option>
              <option value="svg">SVG image</option>
              <option value="mermaid">Mermaid diagram</option>
              <option value="dot">Graphviz DOT</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <button id="compare" type="button" title="Mark what changed since a Git commit, branch or tag">Compare with Git…</button>
          <button id="clearCompare" type="button" hidden>Clear comparison</button>
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
