// Webview script: renders the graph with Cytoscape.js and talks to the extension.
// Globals provided by the scripts loaded before this one: cytoscape (with the dagre layout registered)
// and AtlasLogic (media/atlasLogic.js).
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const L = window.AtlasLogic;

  const KINDS = [
    { id: 'interface', label: 'Interfaces', fill: '#CECBF6', border: '#534AB7' },
    { id: 'class', label: 'Classes', fill: '#9FE1CB', border: '#0F6E56' },
    { id: 'struct', label: 'Structs', fill: '#FAC775', border: '#854F0B' },
    { id: 'record', label: 'Records', fill: '#F5C4B3', border: '#993C1D' },
    { id: 'enum', label: 'Enums', fill: '#D3D1C7', border: '#5F5E5A' },
    { id: 'delegate', label: 'Delegates', fill: '#B5D4F4', border: '#185FA5' },
  ];

  // color: [VS Code theme variable, fallback]; line: how the swatch and the edges are drawn.
  const EDGE_KINDS = [
    { id: 'inherits', label: 'Inheritance', color: ['--vscode-editor-foreground', '#cccccc'], line: 'solid' },
    { id: 'implements', label: 'Implements', color: ['--vscode-editor-foreground', '#cccccc'], line: 'dashed' },
    { id: 'uses', label: 'Uses types', color: ['--vscode-descriptionForeground', '#8a8a8a'], line: 'solid' },
    { id: 'calls', label: 'Method calls', color: ['--vscode-charts-orange', '#d18616'], line: 'dotted' },
    { id: 'accesses', label: 'Property and field access', color: ['--vscode-charts-purple', '#b180d7'], line: 'dotted' },
    { id: 'registers', label: 'DI registrations', color: ['--vscode-charts-green', '#3fa66b'], line: 'dashed' },
    { id: 'events', label: 'Events', color: ['--vscode-charts-red', '#d9534f'], line: 'dotted' },
    { id: 'annotated', label: 'Attributes', color: ['--vscode-charts-yellow', '#c9a227'], line: 'dashed' },
    { id: 'xaml', label: 'XAML references', color: ['--vscode-charts-blue', '#3794ff'], line: 'dashed' },
  ];

  const LANGUAGES = [
    { id: 'csharp', label: 'C#' },
    { id: 'visualbasic', label: 'Visual Basic' },
  ];

  const HUB_METRICS = [
    { id: 'coupling', label: 'Most coupled (in + out)' },
    { id: 'fanIn', label: 'Most used by others (fan-in)' },
    { id: 'fanOut', label: 'Depends on most (fan-out)' },
    { id: 'instability', label: 'Most unstable' },
    { id: 'lines', label: 'Largest (lines)' },
  ];

  const NODE_HEIGHT = 30;
  // From this many drawn types on, the fast layered layout of atlasLogic replaces dagre, which becomes far too
  // slow for large maps (it inserts a helper node for every rank a long edge spans).
  const FAST_LAYOUT_LIMIT = 80;
  const FAST_LAYOUT_PAIRS = 200;
  const MAX_EXTRA_HEIGHT = 30;

  const state = {
    kinds: new Set(KINDS.map((k) => k.id)),
    languages: new Set(LANGUAGES.map((l) => l.id)),
    edgeKinds: new Set(EDGE_KINDS.map((k) => k.id)),
    projects: new Set(),
    nsFilter: new Set(), // namespaces that are shown ('' is the global namespace)
    query: '',
    focus: false,
    namespaces: 'off', // off | grouped | nested
    collapse: 'none', // none | namespace | project
    expanded: new Set(), // "namespace:Shop.Api": groups the user opened while collapsing
    sizeBy: 'uniform', // uniform | coupling | fanIn | lines
    markCycles: true,
    applyUnusedIgnore: true,
    settings: {},
    showViolations: true,
    hubMetric: 'coupling',
    rulesInfo: null, // { file?, error? } from the extension
    rules: null, // result of AtlasLogic.parseRules
    selected: null,
  };

  let cy = null;
  let currentGraph = null;
  let lastVisibleKey = '';
  let analysis = null;

  const $ = (id) => document.getElementById(id);

  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }

  function link(text, onClick, title) {
    const a = el('a', { textContent: text, tabIndex: 0, role: 'link' });
    if (title) a.title = title;
    a.addEventListener('click', onClick);
    a.addEventListener('keydown', (e) => { if (e.key === 'Enter') onClick(); });
    return a;
  }

  // Namespace frames are compound nodes next to the type nodes; they are not types themselves.
  function namespaceId(namespace) {
    return 'ns:' + namespace;
  }

  function parentOf(node) {
    return state.namespaces !== 'off' && node.namespace ? namespaceId(node.namespace) : undefined;
  }

  /** The frame around a frame: only when nested, "Shop" for "Shop.Api". */
  function frameParent(full) {
    const dot = full.lastIndexOf('.');
    return state.namespaces === 'nested' && dot > 0 ? namespaceId(full.slice(0, dot)) : undefined;
  }

  /** A nested frame shows only its own part of the name, because the frame around it shows the rest. */
  function frameLabel(full) {
    return state.namespaces === 'nested' ? full.slice(full.lastIndexOf('.') + 1) : full;
  }

  /** Every namespace that has types, plus all the namespaces above them, for the nested frames. */
  function allNamespaces(graph) {
    const all = new Set();
    for (const namespace of new Set(graph.nodes.map((n) => n.namespace).filter(Boolean))) {
      const parts = namespace.split('.');
      for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join('.'));
    }
    return [...all];
  }

  /** The real types: no namespace frames and no collapsed groups. */
  function typeNodes() {
    return cy.nodes('[!isNamespace][!isGroup][!isGhost]');
  }

  /** What is drawn at the moment. */
  function shown() {
    return cy.elements().not('.hidden, .collapsed');
  }

  // Older data has no language: it was C# only.
  function languageOf(node) {
    return node.language || 'csharp';
  }

  function languageLabel(id) {
    return (LANGUAGES.find((l) => l.id === id) || LANGUAGES[0]).label;
  }

  function css(name, fallback) {
    return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
  }

  function nameOf(id) {
    const node = cy.getElementById(id);
    return node.nonempty() ? node.data('name') : id;
  }

  // ---------------------------------------------------------------- loading

  function load(graph, settings, rules) {
    currentGraph = graph;
    state.settings = settings || {};
    $('changedBar').hidden = true;
    $('reloadMap').disabled = false;
    state.baseline = null;
    $('compare').hidden = false;
    $('clearCompare').hidden = true;
    $('changesBox').hidden = true;
    state.selected = null;
    state.expanded = new Set();
    // The settings only give the starting values; the toolbar can change them afterwards.
    const grouping = settings && settings.namespaceGrouping;
    state.namespaces = ['off', 'grouped', 'nested'].includes(grouping) ? grouping : 'off';
    $('namespaces').value = state.namespaces;
    state.projects = new Set(graph.nodes.map((n) => n.project));
    state.nsFilter = new Set(graph.nodes.map((n) => n.namespace || ''));
    $('namespaceSearch').value = '';
    lastVisibleKey = '';

    setRulesInfo(rules, false);

    $('root').textContent = graph.root.split(/[\\/]/).pop();
    $('empty').hidden = graph.nodes.length > 0;

    buildFilters(graph);
    buildGraph(graph, settings);
    applyView();
    showDetails(null);
  }

  // ------------------------------------------------------------- comparison

  /** Marks what changed since an earlier revision: new types and dependencies, and the removed ones as ghosts. */
  function showBaseline(label, previous) {
    if (!cy || !currentGraph) return;
    clearBaseline(false);

    const diff = L.diffGraphs(previous, currentGraph);
    state.baseline = { label, diff };

    cy.batch(() => {
      for (const node of diff.removedNodes) {
        if (cy.getElementById(node.id).nonempty()) continue;
        cy.add({
          group: 'nodes',
          data: { ...node, label: node.name, h: NODE_HEIGHT, isGhost: true, file: undefined },
          classes: 'ghost removed',
        });
      }

      for (const id of diff.addedNodes) cy.getElementById(id).addClass('added');

      const byKey = new Map();
      cy.edges().not('.synthetic, .ghost').forEach((edge) => {
        byKey.set(L.edgeKey({ source: edge.data('source'), target: edge.data('target'), kind: edge.data('kind') }), edge);
      });
      for (const edge of diff.addedEdges) {
        const found = byKey.get(L.edgeKey(edge));
        if (found) found.addClass('added');
      }

      diff.removedEdges.forEach((edge, index) => {
        if (cy.getElementById(edge.source).empty() || cy.getElementById(edge.target).empty()) return;
        cy.add({
          group: 'edges',
          data: { id: 'ghost:' + index, source: edge.source, target: edge.target, kind: edge.kind, weight: edge.weight || 1 },
          classes: 'ghost removed',
        });
      });
    });

    $('compare').textContent = 'Compare with Git…';
    $('clearCompare').hidden = false;
    $('changesBox').hidden = false;
    $('changesBox').open = true;
    lastVisibleKey = '';
    applyView();
    renderChanges();
  }

  function clearBaseline(apply = true) {
    if (!cy) return;
    cy.remove('.ghost');
    cy.elements().removeClass('added removed');
    state.baseline = null;
    $('clearCompare').hidden = true;
    $('changesBox').hidden = true;
    if (apply) {
      lastVisibleKey = '';
      applyView();
    }
  }

  function renderChanges() {
    const box = $('changes');
    box.replaceChildren();
    if (!state.baseline) return;

    const { label, diff } = state.baseline;
    const total = diff.addedNodes.length + diff.removedNodes.length + diff.addedEdges.length + diff.removedEdges.length;
    $('changeCount').textContent = total === 0 ? '✓' : String(total);

    box.append(el('p', { className: 'hint', textContent: `Compared with ${label}. Green: new, red dashed: removed.` }));
    if (total === 0) {
      box.append(el('p', { textContent: 'No type and no dependency changed.' }));
      return;
    }

    const section = (title, items) => {
      if (items.length === 0) return;
      box.append(el('p', { className: 'sub', textContent: `${title}: ${items.length}` }));
      const list = el('ul', { className: 'links' });
      for (const item of items.slice(0, 100)) list.append(el('li', {}, ...item));
      box.append(list);
      if (items.length > 100) box.append(el('p', { className: 'hint', textContent: `... and ${items.length - 100} more` }));
    };

    const typeItem = (id, name) => [link(name, () => select(id), id)];
    const edgeItem = (edge) => [
      link(`${nameOf(edge.source)} → ${nameOf(edge.target)}`, () => focusEdge(edge)),
      el('span', { className: 'edge', textContent: edge.kind }),
    ];

    section('New types', diff.addedNodes.map((id) => typeItem(id, nameOf(id))));
    section('Removed types', diff.removedNodes.map((node) => typeItem(node.id, node.name)));
    section('New dependencies', diff.addedEdges.map(edgeItem));
    section('Removed dependencies', diff.removedEdges.map(edgeItem));
  }

  /** Selects the source of a dependency, so that its neighbours (and with them the dependency) are in view. */
  function focusEdge(edge) {
    const source = cy.getElementById(edge.source);
    if (source.nonempty() && !source.hasClass('hidden')) select(edge.source);
  }

  function setRulesInfo(info, apply = true) {
    state.rulesInfo = info || null;
    state.rules = info && info.data !== undefined ? L.parseRules(info.data) : null;
    if (apply && cy) {
      lastVisibleKey = '';
      applyView();
    }
  }

  /**
   * "all / none" in the heading of a filter group. `apply(on)` changes the set behind the checkboxes;
   * the checkboxes of the box follow, and the map is updated once.
   */
  function addBulk(headingId, boxId, apply) {
    const heading = $(headingId);
    heading.querySelector('.bulk')?.remove();

    const setAll = (on) => {
      apply(on);
      for (const input of $(boxId).querySelectorAll('input[type="checkbox"]')) {
        if (!input.closest('label').hidden) input.checked = on;
      }
      applyView();
    };

    heading.append(el('span', { className: 'bulk' },
      link('all', () => setAll(true), 'Show everything in this list'),
      ' · ',
      link('none', () => setAll(false), 'Hide everything in this list'),
    ));
  }

  /** A set that follows "all / none" for a list of values. */
  const bulkOf = (set, values) => (on) => {
    for (const value of values) {
      if (on) set.add(value);
      else set.delete(value);
    }
  };

  /** Namespaces with a count each; the search box narrows the list, and "all / none" apply to what is listed. */
  function buildNamespaceList(graph) {
    const box = $('namespaceList');
    box.replaceChildren();

    const counts = new Map();
    for (const node of graph.nodes) counts.set(node.namespace || '', (counts.get(node.namespace || '') || 0) + 1);

    const names = [...counts.keys()].sort((a, b) => a.localeCompare(b));
    $('namespacesHeading').hidden = names.length < 2;
    $('namespaceSearch').hidden = names.length < 2;
    box.hidden = names.length < 2;
    if (names.length < 2) return;

    for (const name of names) {
      const row = checkbox(name || '(global)', state.nsFilter.has(name), counts.get(name), null, (on) => toggle(state.nsFilter, name, on));
      row.title = name || '(global namespace)';
      row.dataset.namespace = name;
      box.append(row);
    }

    const visibleNames = () => [...box.children].filter((row) => !row.hidden).map((row) => row.dataset.namespace);
    addBulk('namespacesHeading', 'namespaceList', (on) => bulkOf(state.nsFilter, visibleNames())(on));
  }

  function buildFilters(graph) {
    const kindBox = $('kinds');
    kindBox.replaceChildren();
    for (const kind of KINDS) {
      const count = graph.nodes.filter((n) => n.kind === kind.id).length;
      const swatch = el('span', { className: 'swatch' });
      swatch.style.background = kind.fill;
      swatch.style.borderColor = kind.border;
      kindBox.append(checkbox(kind.label, state.kinds.has(kind.id), count, swatch, (on) => {
        toggle(state.kinds, kind.id, on);
      }));
    }

    const edgeBox = $('edgeKinds');
    edgeBox.replaceChildren();
    for (const kind of EDGE_KINDS) {
      const count = graph.edges.filter((e) => e.kind === kind.id).length;
      const swatch = el('span', { className: 'line' });
      swatch.style.borderTop = `2px ${kind.line} ${css(kind.color[0], kind.color[1])}`;
      edgeBox.append(checkbox(kind.label, state.edgeKinds.has(kind.id), count, swatch, (on) => {
        toggle(state.edgeKinds, kind.id, on);
      }));
    }

    // The language filter only makes sense, and only shows up, in solutions that mix languages.
    const present = LANGUAGES.filter((l) => graph.nodes.some((n) => languageOf(n) === l.id));
    state.languages = new Set(present.map((l) => l.id));
    $('languagesHeading').hidden = present.length < 2;
    const languageBox = $('languages');
    languageBox.replaceChildren();
    if (present.length > 1) {
      for (const language of present) {
        const count = graph.nodes.filter((n) => languageOf(n) === language.id).length;
        languageBox.append(checkbox(language.label, true, count, null, (on) => toggle(state.languages, language.id, on)));
      }
    }

    const projectBox = $('projects');
    projectBox.replaceChildren();
    const projects = [...state.projects].sort();
    for (const project of projects) {
      const count = graph.nodes.filter((n) => n.project === project).length;
      projectBox.append(checkbox(project, true, count, null, (on) => toggle(state.projects, project, on)));
    }

    // "all / none" where a list has more than one entry.
    addBulk('relationshipsHeading', 'edgeKinds', bulkOf(state.edgeKinds, EDGE_KINDS.map((k) => k.id)));
    addBulk('typesHeading', 'kinds', bulkOf(state.kinds, KINDS.map((k) => k.id)));
    if (present.length > 1) addBulk('languagesHeading', 'languages', bulkOf(state.languages, present.map((l) => l.id)));
    else $('languagesHeading').querySelector('.bulk')?.remove();
    if (projects.length > 1) addBulk('projectsHeading', 'projects', bulkOf(state.projects, projects));
    else $('projectsHeading').querySelector('.bulk')?.remove();

    buildNamespaceList(graph);
  }

  function checkbox(text, checked, count, swatch, onChange) {
    const input = el('input', { type: 'checkbox', checked });
    input.addEventListener('change', () => onChange(input.checked));
    const label = el('label', { className: 'check' }, input);
    if (swatch) label.append(swatch);
    label.append(el('span', { textContent: text }), el('span', { className: 'count', textContent: String(count) }));
    return label;
  }

  function toggle(set, value, on) {
    if (on) set.add(value);
    else set.delete(value);
    applyView();
  }

  // ------------------------------------------------------------------ graph

  function buildGraph(graph, settings) {
    if (cy) cy.destroy();

    const fg = css('--vscode-editor-foreground', '#cccccc');
    const accent = css('--vscode-focusBorder', '#007fd4');
    const edgeColor = css('--vscode-descriptionForeground', '#8a8a8a');
    const callColor = css('--vscode-charts-orange', '#d18616');
    const accessColor = css('--vscode-charts-purple', '#b180d7');
    const kindColor = (id) => {
      const kind = EDGE_KINDS.find((k) => k.id === id);
      return css(kind.color[0], kind.color[1]);
    };
    const warnColor = css('--vscode-charts-red', '#f14c4c');
    const addedColor = css('--vscode-charts-green', '#3fa66b');
    const panel = css('--vscode-editorWidget-background', '#252526');

    const manyEdges = graph.edges.length > 1500;

    cy = cytoscape({
      // While panning and zooming, large maps are drawn from a texture and without the edges.
      textureOnViewport: manyEdges,
      hideEdgesOnViewport: graph.edges.length > 3000,
      container: $('cy'),
      elements: [
        ...allNamespaces(graph).map((namespace) => ({
          group: 'nodes',
          data: {
            id: namespaceId(namespace),
            full: namespace,
            label: frameLabel(namespace),
            isNamespace: true,
            ...(frameParent(namespace) ? { parent: frameParent(namespace) } : {}),
          },
          classes: 'namespace hidden',
        })),
        ...graph.nodes.map((n) => ({
          group: 'nodes',
          data: { ...n, label: n.name, h: NODE_HEIGHT, ...(parentOf(n) ? { parent: parentOf(n) } : {}) },
        })),
        ...graph.edges.map((e, i) => ({
          group: 'edges',
          data: { id: 'edge:' + i, source: e.source, target: e.target, kind: e.kind, weight: e.weight },
        })),
      ],
      minZoom: 0.05,
      maxZoom: 3,
      // Multiplier for the mouse wheel; 1 is Cytoscape's default. Set in the extension settings.
      wheelSensitivity: (settings && settings.zoomSpeed) || 1,
      style: [
        {
          selector: 'node[!isNamespace]',
          style: {
            label: 'data(label)',
            shape: 'round-rectangle',
            width: 'label',
            height: 'data(h)',
            padding: '12px',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': 12,
            color: '#1f1f1f',
            'border-width': 1,
          },
        },
        ...KINDS.map((k) => ({
          selector: `node[kind = "${k.id}"]`,
          style: { 'background-color': k.fill, 'border-color': k.border },
        })),
        {
          selector: 'node.group',
          style: { 'background-color': panel, color: fg, 'border-color': edgeColor, 'border-width': 2, 'font-weight': 'bold' },
        },
        {
          selector: 'edge',
          style: {
            // Curved edges are expensive to draw: large maps get straight lines.
            'curve-style': manyEdges ? 'straight' : 'bezier',
            width: 'mapData(weight, 1, 10, 1, 4)',
            'line-color': edgeColor,
            'target-arrow-color': edgeColor,
            'target-arrow-shape': 'vee',
            'arrow-scale': 0.9,
            opacity: 0.8,
          },
        },
        { selector: 'edge[kind = "inherits"]', style: { 'target-arrow-shape': 'triangle', 'line-color': fg, 'target-arrow-color': fg } },
        { selector: 'edge[kind = "implements"]', style: { 'target-arrow-shape': 'triangle', 'line-style': 'dashed', 'line-color': fg, 'target-arrow-color': fg } },
        {
          selector: 'edge[kind = "calls"]',
          style: { 'line-style': 'dotted', 'line-color': callColor, 'target-arrow-color': callColor },
        },
        {
          selector: 'edge[kind = "accesses"]',
          style: { 'line-style': 'dotted', 'line-color': accessColor, 'target-arrow-color': accessColor },
        },
        ...['registers', 'events', 'annotated', 'xaml'].map((id) => ({
          selector: `edge[kind = "${id}"]`,
          style: {
            'line-style': EDGE_KINDS.find((k) => k.id === id).line,
            'line-color': kindColor(id),
            'target-arrow-color': kindColor(id),
          },
        })),
        {
          selector: 'node.namespace',
          style: {
            label: 'data(label)',
            shape: 'round-rectangle',
            padding: '18px',
            'background-color': fg,
            'background-opacity': 0.06,
            'border-width': 1,
            'border-style': 'dashed',
            'border-color': edgeColor,
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': -4,
            'font-size': 11,
            color: edgeColor,
            events: 'no',
          },
        },
        { selector: 'node.cyclic', style: { 'border-width': 3, 'border-color': warnColor } },
        {
          selector: 'edge.violation',
          style: { width: 3, opacity: 1, 'line-color': warnColor, 'target-arrow-color': warnColor, 'line-style': 'solid', 'z-index': 10 },
        },
        // Comparison with an earlier revision: new in green, removed (drawn again as a ghost) in red.
        { selector: 'node.added', style: { 'border-width': 3, 'border-color': addedColor } },
        { selector: 'node.removed', style: { 'border-width': 2, 'border-style': 'dashed', 'border-color': warnColor, opacity: 0.6 } },
        {
          selector: 'edge.added',
          style: { width: 3, opacity: 1, 'line-color': addedColor, 'target-arrow-color': addedColor, 'z-index': 9 },
        },
        {
          selector: 'edge.removed',
          style: { width: 2, opacity: 0.9, 'line-color': warnColor, 'target-arrow-color': warnColor, 'line-style': 'dashed', 'z-index': 9 },
        },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': accent } },
        { selector: '.faded', style: { opacity: 0.15 } },
        { selector: '.hidden, .collapsed', style: { display: 'none' } },
      ],
    });

    cy.on('tap', 'node[!isNamespace]', (event) => select(event.target.id()));
    cy.on('tap', (event) => {
      if (event.target === cy) select(null);
    });
    cy.on('dbltap', 'node[!isNamespace]', (event) => {
      if (event.target.data('isGroup')) expandGroup(event.target);
      else openNode(event.target);
    });
  }

  function select(id) {
    let node = id ? cy.getElementById(id) : null;

    // A type inside a collapsed group: open the group first, so that the type is there to select.
    if (node && node.nonempty() && node.hasClass('collapsed')) {
      state.expanded.add(groupKeyOf(node.data()));
      lastVisibleKey = '';
      applyView();
      node = cy.getElementById(id);
    }

    state.selected = id;
    cy.elements().unselect();
    if (node && node.nonempty()) node.select();
    applyView();
    showDetails(node && node.nonempty() ? node : null);
  }

  // --------------------------------------------------------------- collapse

  function collapseKeyOf(data) {
    return state.collapse === 'namespace' ? data.namespace || '(global namespace)' : data.project;
  }

  function groupKeyOf(data) {
    return `${state.collapse}:${collapseKeyOf(data)}`;
  }

  /** Replaces the types of each collapsed namespace or project by one node and merges their edges. */
  function applyCollapse() {
    if (state.collapse === 'none') return;

    const nodes = typeNodes().not('.hidden').map((n) => n.data());
    const sizes = new Map();
    for (const data of nodes) sizes.set(collapseKeyOf(data), (sizes.get(collapseKeyOf(data)) || 0) + 1);

    // A group of one type is not worth collapsing, nor is one the user opened.
    const keyOf = (data) => (sizes.get(collapseKeyOf(data)) > 1 && !state.expanded.has(groupKeyOf(data)) ? groupKeyOf(data) : null);

    const edges = cy.edges().not('.hidden').map((e) => ({
      source: e.data('source'),
      target: e.data('target'),
      kind: e.data('kind'),
      weight: e.data('weight'),
    }));
    const result = L.collapse(nodes, edges, keyOf);

    for (const [id, members] of result.groups) {
      const key = id.slice('group:'.length + state.collapse.length + 1);
      const label = `${key} (${members.length})`;
      cy.add({
        group: 'nodes',
        data: { id, isGroup: true, name: label, label, h: 36, key, members, project: '' },
        classes: 'synthetic group',
      });
      for (const member of members) cy.getElementById(member).addClass('collapsed');
    }

    let index = 0;
    for (const edge of result.edges) {
      if (!edge.source.startsWith('group:') && !edge.target.startsWith('group:')) continue;
      cy.add({
        group: 'edges',
        data: { id: 'agg:' + index++, source: edge.source, target: edge.target, kind: edge.kind, weight: edge.weight },
        classes: 'synthetic',
      });
    }

    cy.edges().not('.synthetic').forEach((edge) => {
      if (edge.source().hasClass('collapsed') || edge.target().hasClass('collapsed')) edge.addClass('collapsed');
    });
  }

  function expandGroup(group) {
    state.expanded.add(`${state.collapse}:${group.data('key')}`);
    select(null);
    lastVisibleKey = '';
    applyView();
  }

  function collapseAgain(data) {
    state.expanded.delete(groupKeyOf(data));
    select(null);
    lastVisibleKey = '';
    applyView();
  }

  // ----------------------------------------------------------------- filter

  /** Applies filters, collapsing, search and focus. Only runs the layout if what is drawn changed. */
  function applyView() {
    if (!cy) return;

    const query = state.query.trim().toLowerCase();
    const selected = state.selected ? cy.getElementById(state.selected) : null;
    const hasSelection = selected !== null && selected.nonempty();
    const neighbourhood = hasSelection ? selected.closedNeighborhood() : null;

    cy.batch(() => {
      cy.remove('.synthetic');
      cy.elements().removeClass('collapsed');

      typeNodes().forEach((node) => {
        const visible =
          state.kinds.has(node.data('kind')) &&
          state.projects.has(node.data('project')) &&
          state.nsFilter.has(node.data('namespace') || '') &&
          state.languages.has(languageOf(node.data())) &&
          (!state.focus || !neighbourhood || neighbourhood.contains(node));
        node.toggleClass('hidden', !visible);
      });

      cy.edges().forEach((edge) => {
        edge.toggleClass(
          'hidden',
          !state.edgeKinds.has(edge.data('kind')) || edge.source().hasClass('hidden') || edge.target().hasClass('hidden'),
        );
      });

      applyCollapse();

      // A namespace frame shows only while grouping is on and it still contains a drawn type.
      cy.nodes('.namespace').forEach((frame) => {
        const hasVisibleType = frame.descendants().filter('[!isNamespace]').not('.hidden, .collapsed').nonempty();
        frame.toggleClass('hidden', state.namespaces === 'off' || !hasVisibleType);
      });

      cy.elements().removeClass('faded');
      const drawn = shown();

      if (query) {
        cy.nodes('[!isNamespace]').not('.hidden, .collapsed').forEach((node) => {
          const matches = node.data('isGroup')
            ? node.data('members').some((id) => id.toLowerCase().includes(query))
            : node.id().toLowerCase().includes(query);
          if (!matches) node.addClass('faded');
        });
      } else if (hasSelection && !state.focus) {
        drawn.not(neighbourhood).addClass('faded');
      }
    });

    const visibleKey =
      (state.namespaces === 'off' ? '' : state.namespaces + '#') +
      state.sizeBy + '#' +
      shown().map((e) => e.id()).sort().join('|');

    if (visibleKey !== lastVisibleKey) {
      lastVisibleKey = visibleKey;
      computeAnalysis();
      layout();
      updateGroups();
      renderAnalysis();
    }
  }

  function layout() {
    const types = shown().nodes('[!isNamespace]');

    // dagre only needs to know that two types are connected, not by how many kinds of relationship.
    const pairs = new Set();
    const edges = shown().edges().filter((edge) => {
      const key = edge.data('source') + '\u0000' + edge.data('target');
      if (pairs.has(key)) return false;
      pairs.add(key);
      return true;
    });

    // dagre is slow for many types and also for few types that are densely connected, for example the
    // groups of a collapsed solution: 40 groups with a thousand relationships take it several seconds.
    if (types.length > FAST_LAYOUT_LIMIT || pairs.size > FAST_LAYOUT_PAIRS) {
      fastLayout(types);
      return;
    }

    const nodes = shown().nodes();

    nodes.union(edges).layout({
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 24,
      rankSep: 70,
      padding: 30,
      animate: false,
      fit: true,
    }).run();

    if (state.namespaces !== 'off') separateRows();
  }

  /** Layout for large maps: see layeredLayout in atlasLogic.js. Namespace frames follow their types. */
  function fastLayout(types) {
    const byId = new Map(types.map((n) => [n.id(), n]));
    const grouped = state.namespaces !== 'off';
    const positions = L.layeredLayout(
      types.map((n) => ({ id: n.id(), namespace: n.data('isGroup') ? '' : n.data('namespace') || '' })),
      shown().edges().map((e) => ({ source: e.data('source'), target: e.data('target') })),
      {
        size: (n) => ({ w: byId.get(n.id).outerWidth(), h: byId.get(n.id).outerHeight() }),
        groupOf: (n) => (grouped ? n.namespace : ''),
      },
    );

    cy.batch(() => {
      for (const [id, position] of positions) byId.get(id).position({ x: position.x, y: position.y });
    });
    cy.fit(shown(), 30);
  }

  /**
   * dagre sometimes places two types of one frame on top of each other when frames are drawn (it does not
   * keep them apart inside a compound node). Types on the same row are moved apart from left to right;
   * frames grow with their content, so nothing else has to change.
   */
  function separateRows() {
    const gap = 24;
    const nodes = shown().nodes('[!isNamespace]').toArray();
    const rows = new Map();
    for (const node of nodes) {
      const key = Math.round(node.position('y'));
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(node);
    }

    cy.batch(() => {
      for (const row of rows.values()) {
        row.sort((a, b) => a.position('x') - b.position('x'));
        for (let i = 1; i < row.length; i++) {
          const left = row[i - 1];
          const right = row[i];
          const needed = left.position('x') + left.outerWidth() / 2 + gap + right.outerWidth() / 2;
          if (right.position('x') < needed) {
            // Everything to the right moves with it, otherwise the shift would only move the overlap.
            const shift = needed - right.position('x');
            for (let j = i; j < row.length; j++) row[j].position({ x: row[j].position('x') + shift, y: row[j].position('y') });
          }
        }
      }
    });
    cy.fit(shown(), 30);
  }

  function openNode(node) {
    if (node.data('file')) {
      vscode.postMessage({ type: 'open', file: node.data('file'), line: node.data('line') });
    }
  }

  // --------------------------------------------------------------- analysis

  /**
   * Cycles, coupling, unused candidates and rule violations of what the filters let through. Collapsing
   * does not change them: they describe the types, not the groups.
   */
  function computeAnalysis() {
    const nodes = typeNodes().not('.hidden').map((n) => n.data());
    const edges = cy.edges().not('.synthetic, .ghost').not('.hidden').map((e) => ({
      source: e.data('source'),
      target: e.data('target'),
      kind: e.data('kind'),
      weight: e.data('weight'),
    }));

    analysis = {
      nodes,
      metrics: L.metrics(nodes, edges),
      cycles: {
        type: L.findCycles(nodes, edges, 'type'),
        namespace: L.findCycles(nodes, edges, 'namespace'),
        project: L.findCycles(nodes, edges, 'project'),
      },
      unused: L.findUnused(
        nodes,
        edges,
        state.applyUnusedIgnore
          ? L.mergeIgnore([state.settings.ignoreUnused, state.rules && state.rules.config.ignoreUnused], state.settings.ignoreUnusedDefaults !== false)
          : null,
      ),
      violations: state.rules ? L.findViolations(nodes, edges, state.rules.config) : [],
    };

    // Node height shows the chosen metric, relative to the largest value that is on screen.
    const value = (data) => {
      const m = analysis.metrics.get(data.id);
      if (state.sizeBy === 'coupling') return m.coupling;
      if (state.sizeBy === 'fanIn') return m.fanIn;
      return state.sizeBy === 'lines' ? data.lines || 0 : 0;
    };
    const largest = Math.max(1, ...nodes.map(value));
    cy.batch(() => {
      typeNodes().forEach((node) => {
        const extra = state.sizeBy === 'uniform' || node.hasClass('hidden') ? 0 : (value(node.data()) / largest) * MAX_EXTRA_HEIGHT;
        node.data('h', Math.round(NODE_HEIGHT + extra));
      });
    });

    applyMarks();
  }

  /** Marks the types in cycles and the edges that break a rule, if the user wants to see them. */
  function applyMarks() {
    if (!analysis) return;

    cy.batch(() => {
      cy.nodes().removeClass('cyclic');
      cy.edges().removeClass('violation');

      if (state.markCycles) {
        for (const cycle of analysis.cycles.type) {
          for (const id of cycle) cy.getElementById(id).addClass('cyclic');
        }
        // A collapsed group is marked if one of its types is in a cycle.
        cy.nodes('.group').forEach((group) => {
          if (group.data('members').some((id) => cy.getElementById(id).hasClass('cyclic'))) group.addClass('cyclic');
        });
      }

      if (state.showViolations && analysis.violations.length > 0) {
        const broken = new Set(analysis.violations.map((v) => `${v.source}\u0000${v.target}\u0000${v.kind}`));
        cy.edges().not('.synthetic').forEach((edge) => {
          if (broken.has(`${edge.data('source')}\u0000${edge.data('target')}\u0000${edge.data('kind')}`)) edge.addClass('violation');
        });
      }
    });
  }

  /** The nodes that stand for these types on screen: the type itself or the group it is collapsed into. */
  function visibleNodesOf(ids) {
    const result = [];
    for (const id of ids) {
      const node = cy.getElementById(id);
      if (node.empty() || node.hasClass('hidden')) continue;
      result.push(node.hasClass('collapsed') ? cy.nodes('.group').filter((g) => g.data('members').includes(id))[0] : node);
    }
    return cy.collection(result.filter(Boolean));
  }

  function focusTypes(title, ids) {
    const nodes = visibleNodesOf(ids);
    if (nodes.empty()) return;
    focusGroup(title, nodes);
  }

  function renderAnalysis() {
    if (!analysis) return;
    renderCycles();
    renderHubs();
    renderUnused();
    renderRules();
  }

  function listOf(names, limit) {
    const shownNames = names.slice(0, limit);
    return shownNames.join(', ') + (names.length > limit ? ` +${names.length - limit}` : '');
  }

  function renderCycles() {
    const box = $('cycles');
    box.replaceChildren();

    const levels = [
      ['type', 'Types'],
      ['namespace', 'Namespaces'],
      ['project', 'Projects'],
    ];

    let total = 0;
    for (const [level, label] of levels) {
      const cycles = analysis.cycles[level];
      total += cycles.length;
      box.append(el('p', { className: 'sub', textContent: `${label}: ${cycles.length === 0 ? 'none' : cycles.length}` }));
      if (cycles.length === 0) continue;

      const list = el('ul', { className: 'links' });
      for (const members of cycles.slice(0, 50)) {
        const names = level === 'type' ? members.map(nameOf) : members;
        const text = `${members.length} · ${listOf(names, 3)}`;
        const ids = level === 'type'
          ? members
          : analysis.nodes.filter((n) => members.includes(level === 'namespace' ? n.namespace || '(global)' : n.project)).map((n) => n.id);
        list.append(el('li', {}, link(text, () => focusTypes(`Cycle of ${members.length} ${label.toLowerCase()}`, ids), names.join(', '))));
      }
      box.append(list);
    }

    $('cycleCount').textContent = total === 0 ? '' : String(total);
  }

  function renderHubs() {
    const box = $('hubs');
    box.replaceChildren();

    const top = L.topBy(analysis.nodes, analysis.metrics, state.hubMetric, 10);
    if (top.length === 0) {
      box.append(el('p', { className: 'hint', textContent: 'Nothing to show.' }));
      return;
    }

    const list = el('ul', { className: 'links' });
    for (const { node, value } of top) {
      const text = state.hubMetric === 'instability' ? value.toFixed(2) : String(value);
      list.append(el('li', {}, link(node.name, () => select(node.id)), el('span', { className: 'edge', textContent: text })));
    }
    box.append(list);
  }

  function renderUnused() {
    const box = $('unused');
    box.replaceChildren();
    const { candidates, ignored } = analysis.unused;
    $('unusedCount').textContent = candidates.length === 0 ? '' : String(candidates.length);

    const toggle = el('input', { type: 'checkbox', checked: state.applyUnusedIgnore });
    toggle.addEventListener('change', () => {
      state.applyUnusedIgnore = toggle.checked;
      computeAnalysis();
      renderAnalysis();
    });
    box.append(el('label', { className: 'check' }, toggle, el('span', { textContent: 'Apply exceptions (defaults, settings and .atlas.json)' })));

    if (candidates.length === 0) {
      box.append(el('p', { className: 'hint', textContent: 'Every type is referenced.' }));
    } else {
      box.append(el('p', {
        className: 'hint',
        textContent: 'Nothing in the analyzed code refers to these. Types used through reflection, DI or serialization look the same; add them under "ignoreUnused" in the rules file.',
      }));

      const limit = 100;
      const list = el('ul', { className: 'links' });
      for (const node of candidates.slice(0, limit)) {
        list.append(el('li', {}, link(node.name, () => select(node.id)), el('span', { className: 'edge', textContent: node.kind })));
      }
      box.append(list);
      if (candidates.length > limit) {
        box.append(el('p', { className: 'hint', textContent: `... and ${candidates.length - limit} more` }));
      }
    }

    if (ignored.length > 0) {
      const details = el('details', {}, el('summary', { textContent: `${ignored.length} hidden by exceptions` }));
      const list = el('ul', { className: 'links' });
      for (const entry of ignored.slice(0, 100)) {
        list.append(el('li', {}, link(entry.node.name, () => select(entry.node.id)), el('span', { className: 'edge', textContent: entry.reason })));
      }
      details.append(list);
      box.append(details);
    }
  }

  function renderRules() {
    const box = $('rules');
    box.replaceChildren();

    const info = state.rulesInfo;
    const buttons = el('div', { className: 'row' });
    const create = el('button', { type: 'button', textContent: 'Create rules file' });
    create.addEventListener('click', () => vscode.postMessage({ type: 'createRules' }));
    const reload = el('button', { type: 'button', textContent: 'Reload' });
    reload.addEventListener('click', () => vscode.postMessage({ type: 'reloadRules' }));
    buttons.append(create, reload);

    if (info && info.error) {
      box.append(el('p', { className: 'problem', textContent: info.error }), buttons);
      $('ruleCount').textContent = '!';
      return;
    }

    if (!state.rules) {
      box.append(el('p', { className: 'hint', textContent: 'No rules file found. Create .atlas.json next to the solution to define layers and what they may use.' }), buttons);
      $('ruleCount').textContent = '';
      return;
    }

    box.append(el('p', { className: 'hint', textContent: info.file }));
    for (const message of state.rules.errors) box.append(el('p', { className: 'problem', textContent: message }));

    const { violations } = analysis;
    const layers = L.assignLayers(analysis.nodes, state.rules.config);
    box.append(el('p', {
      className: 'sub',
      textContent: `${state.rules.config.layers.length} layers (${layers.size} of ${analysis.nodes.length} types assigned), ${violations.length} violation${violations.length === 1 ? '' : 's'}`,
    }));

    const list = el('ul', { className: 'links' });
    for (const v of violations.slice(0, 100)) {
      const text = `${nameOf(v.source)} → ${nameOf(v.target)}`;
      list.append(el('li', {}, link(text, () => focusTypes(v.rule, [v.source, v.target]), v.rule), el('span', { className: 'edge', textContent: v.kind })));
    }
    box.append(list, buttons);
    $('ruleCount').textContent = violations.length === 0 ? '✓' : String(violations.length);
  }

  // ----------------------------------------------------------------- groups

  /**
   * Lists the connected groups of what is drawn, largest first, and the types that have no
   * relationship at all. A group that is cut off from the rest shows up as its own entry.
   */
  function updateGroups() {
    const box = $('groups');
    box.replaceChildren();

    const components = shown().not('.namespace, .ghost').components()
      .map((component) => component.nodes())
      .sort((a, b) => b.length - a.length);
    const groups = components.filter((nodes) => nodes.length > 1);
    const isolated = cy.collection(components.filter((nodes) => nodes.length === 1).map((nodes) => nodes[0]));

    if (components.length === 0) return;

    box.append(el('p', {
      className: 'hint',
      textContent: `${groups.length} connected group${groups.length === 1 ? '' : 's'}, ${isolated.length} isolated type${isolated.length === 1 ? '' : 's'}`,
    }));

    const list = el('ul', { className: 'links' });
    groups.forEach((nodes, index) => list.append(groupItem(`Group ${index + 1}`, nodes)));
    if (isolated.length > 0) list.append(groupItem('Isolated types', isolated));
    box.append(list);
  }

  function groupItem(label, nodes) {
    return el('li', {}, link(label, () => focusGroup(label, nodes)), el('span', { className: 'edge', textContent: `${nodes.length} types` }));
  }

  /** Fades everything except the group, zooms to it and lists its members. */
  /**
   * Centres the map on a node and zooms so that it and its neighbours are in view, without
   * zooming in further than 1.5 for a type that has hardly any neighbours. A node that sits in
   * a collapsed group or is filtered out is brought back first by select().
   */
  function focusInMap(node) {
    if (!cy || node.removed()) return;
    const around = node.closedNeighborhood().nodes().not('.hidden, .collapsed, .namespace');
    const box = around.boundingBox({ includeLabels: false, includeOverlays: false });
    const level = Math.min(1.5, (0.85 * cy.width()) / Math.max(box.w, 1), (0.85 * cy.height()) / Math.max(box.h, 1));
    cy.stop();
    cy.animate({ zoom: Math.max(level, cy.minZoom()), center: { eles: node } }, { duration: 250 });
  }

  function focusGroup(label, nodes) {
    select(null);
    shown().addClass('faded');
    nodes.union(nodes.connectedEdges()).removeClass('faded');
    cy.fit(nodes, 40);
    showList(label, nodes);
  }

  function showList(title, nodes) {
    const limit = 300;
    const box = $('details');
    box.replaceChildren(
      el('p', { className: 'title', textContent: title }),
      el('p', { className: 'sub', textContent: `${nodes.length} types` }),
    );

    const list = el('ul', { className: 'links' });
    const sorted = nodes.toArray().sort((a, b) => a.id().localeCompare(b.id()));
    for (const node of sorted.slice(0, limit)) {
      list.append(el('li', {}, link(node.data('name'), () => select(node.id())), el('span', { className: 'edge', textContent: node.data('project') || '' })));
    }
    box.append(list);

    if (sorted.length > limit) {
      box.append(el('p', { className: 'hint', textContent: `... and ${sorted.length - limit} more` }));
    }
  }

  // ---------------------------------------------------------------- details

  function showDetails(node) {
    const box = $('details');
    box.replaceChildren();

    if (!node) {
      box.append(el('p', { className: 'hint', textContent: 'Select a type to see its relationships. Double-click opens it in the editor.' }));
      return;
    }

    if (node.data('isGroup')) {
      showGroupDetails(node, box);
      return;
    }

    const dependsOn = node.outgoers('edge').not('.hidden, .collapsed');
    const usedBy = node.incomers('edge').not('.hidden, .collapsed');
    const metric1 = analysis && analysis.metrics.get(node.id());

    box.append(
      el('p', { className: 'title', textContent: node.data('name') }),
      el('p', { className: 'sub', textContent: `${node.data('isStatic') ? 'static ' : ''}${node.data('kind')} in ${node.data('namespace') || '(global namespace)'}` }),
      el('p', { className: 'sub', textContent: `${node.data('project')} · ${languageLabel(languageOf(node.data()))}` }),
      el('div', { className: 'metrics' },
        metric('Depends on', dependsOn.length),
        metric('Used by', usedBy.length),
        metric('Methods', node.data('methods')),
        metric('Lines', node.data('lines')),
      ),
    );

    if (metric1) {
      box.append(el('p', { className: 'sub', textContent: `Instability ${metric1.instability.toFixed(2)} (0 = stable, 1 = unstable)` }));
    }
    if (node.hasClass('cyclic')) {
      box.append(el('p', { className: 'problem', textContent: 'Part of a dependency cycle.' }));
    }

    const focus = el('button', { textContent: 'Focus in map', title: 'Centre the map on this type and its neighbours' });
    focus.addEventListener('click', () => focusInMap(node));
    const open = el('button', { textContent: 'Open in editor', disabled: !node.data('file') });
    open.addEventListener('click', () => openNode(node));
    box.append(focus, ' ', open);

    if (state.collapse !== 'none' && state.expanded.has(groupKeyOf(node.data()))) {
      const collapse = el('button', { textContent: `Collapse ${state.collapse} again` });
      collapse.addEventListener('click', () => collapseAgain(node.data()));
      box.append(' ', collapse);
    }

    box.append(el('h3', { textContent: 'Depends on' }), linkList(dependsOn, 'target'));
    box.append(el('h3', { textContent: 'Used by' }), linkList(usedBy, 'source'));

    const members = node.data('memberDetails');
    if (members && members.length > 0) {
      box.append(el('h3', { textContent: `Members (${members.length})` }), memberList(node, members));
    }
  }

  function showGroupDetails(node, box) {
    const members = node.data('members');
    box.append(
      el('p', { className: 'title', textContent: node.data('key') }),
      el('p', { className: 'sub', textContent: `Collapsed ${state.collapse}, ${members.length} types` }),
    );

    const focus = el('button', { textContent: 'Focus in map', title: 'Centre the map on this group' });
    focus.addEventListener('click', () => focusInMap(node));
    const expand = el('button', { textContent: 'Expand' });
    expand.addEventListener('click', () => expandGroup(node));
    box.append(focus, ' ', expand);

    box.append(el('h3', { textContent: 'Depends on' }), linkList(node.outgoers('edge'), 'target'));
    box.append(el('h3', { textContent: 'Used by' }), linkList(node.incomers('edge'), 'source'));

    box.append(el('h3', { textContent: 'Types' }));
    const list = el('ul', { className: 'links' });
    for (const id of [...members].sort().slice(0, 300)) {
      list.append(el('li', {}, link(nameOf(id), () => select(id))));
    }
    box.append(list);
  }

  const REF_VERBS = { calls: 'calls', accesses: 'accesses', uses: 'uses', registers: 'registers', events: 'uses event of', annotated: 'is marked with' };

  /** The members of a type with what each of them calls, accesses or uses. */
  function memberList(node, members) {
    const box = el('div', { className: 'members' });

    for (const member of members.slice(0, 300)) {
      const details = el('details', {});
      details.append(el('summary', {},
        el('span', { className: 'kind', textContent: member.kind }),
        ' ',
        member.name,
        el('span', { className: 'edge', textContent: member.refs.length === 0 ? '' : String(member.refs.length) }),
      ));

      const file = member.file || node.data('file');
      if (file) {
        details.append(el('p', {}, link('Open in editor', () => vscode.postMessage({ type: 'open', file, line: member.line }))));
      }

      const list = el('ul', { className: 'links' });
      for (const ref of member.refs) {
        const target = nameOf(ref.target) + (ref.member ? '.' + ref.member : '');
        list.append(el('li', {}, el('span', { className: 'edge', textContent: REF_VERBS[ref.kind] || ref.kind }), ' ', link(target, () => select(ref.target))));
      }
      if (member.refs.length === 0) list.append(el('li', { className: 'hint', textContent: 'Nothing in the solution' }));
      details.append(list);

      box.append(details);
    }

    return box;
  }

  function metric(label, value) {
    return el('div', { className: 'metric' },
      el('div', { className: 'label', textContent: label }),
      el('div', { className: 'value', textContent: String(value) }),
    );
  }

  function linkList(edges, end) {
    const list = el('ul', { className: 'links' });
    if (edges.empty()) {
      list.append(el('li', { className: 'hint', textContent: 'None' }));
      return list;
    }

    const sorted = edges.toArray().sort((a, b) => a.data(end).localeCompare(b.data(end)));
    for (const edge of sorted) {
      const id = edge.data(end);
      list.append(el('li', {}, link(nameOf(id), () => select(id)), el('span', { className: 'edge', textContent: edge.data('kind') })));
    }
    return list;
  }

  // --------------------------------------------------------------- toolbar

  $('search').addEventListener('input', (e) => {
    state.query = e.target.value;
    applyView();
  });

  $('focus').addEventListener('change', (e) => {
    state.focus = e.target.checked;
    applyView();
  });

  $('namespaces').addEventListener('change', (e) => {
    state.namespaces = e.target.value;
    if (!cy) return;
    cy.batch(() => {
      // Frames first, so the frame a type moves into already has its own place.
      cy.nodes('.namespace').forEach((frame) => {
        const parent = frameParent(frame.data('full'));
        frame.data('label', frameLabel(frame.data('full')));
        frame.move({ parent: parent === undefined ? null : parent });
      });
      typeNodes().forEach((node) => {
        const parent = parentOf(node.data());
        node.move({ parent: parent === undefined ? null : parent });
      });
    });
    applyView();
  });

  $('collapse').addEventListener('change', (e) => {
    state.collapse = e.target.value;
    state.expanded = new Set();
    select(null);
    lastVisibleKey = '';
    applyView();
  });

  // ----------------------------------------------------------------- export

  /** The map as it is shown at the moment: filters, collapsed groups and frames included. */
  function exportModel() {
    const visible = shown();
    const kindStyle = new Map(KINDS.map((k) => [k.id, k]));
    const edgeColors = {};
    for (const kind of EDGE_KINDS) edgeColors[kind.id] = css(kind.color[0], kind.color[1]);

    const nodes = visible.nodes('[!isNamespace]').map((n) => {
      const box = n.boundingBox({ includeLabels: false, includeOverlays: false });
      const style = kindStyle.get(n.data('kind')) || { fill: '#dddddd', border: '#666666' };
      return {
        id: n.id(),
        label: n.data('label'),
        kind: n.data('isGroup') ? 'group' : n.data('kind'),
        namespace: n.data('isGroup') ? '' : n.data('namespace') || '',
        project: n.data('project') || '',
        x: (box.x1 + box.x2) / 2,
        y: (box.y1 + box.y2) / 2,
        w: box.w,
        h: box.h,
        fill: style.fill,
        border: style.border,
        textColor: '#222222',
      };
    });

    const frames = visible.nodes('.namespace').map((f) => {
      const box = f.boundingBox({ includeLabels: false, includeOverlays: false });
      return { x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2, w: box.w, h: box.h, label: f.data('label') };
    });

    const edges = visible.edges().map((e) => ({
      source: e.data('source'),
      target: e.data('target'),
      kind: e.data('kind'),
      weight: e.data('weight') || 1,
    }));

    return {
      nodes,
      edges,
      frames,
      pageFrames: state.namespaces !== 'off',
      colors: { background: '#ffffff', text: '#222222', frame: '#888888', edge: '#888888', edges: edgeColors },
    };
  }

  function exportMap(format) {
    if (!cy || cy.nodes().empty()) return;
    const model = exportModel();
    // The text formats name the frames after the namespace of the nodes.
    const textModel = { nodes: model.nodes, edges: model.edges, frames: model.pageFrames };

    if (format === 'png') {
      const uri = cy.png({ full: true, scale: 2, bg: css('--vscode-editor-background', '#1e1e1e'), output: 'base64uri' });
      vscode.postMessage({ type: 'save', format, content: uri.slice(uri.indexOf(',') + 1) });
    } else if (format === 'svg') {
      vscode.postMessage({ type: 'save', format, content: L.toSvg({ ...model, frames: model.pageFrames ? model.frames : [] }) });
    } else if (format === 'mermaid') {
      vscode.postMessage({ type: 'save', format, content: L.toMermaid(textModel) });
    } else if (format === 'dot') {
      vscode.postMessage({ type: 'save', format, content: L.toDot(textModel) });
    } else if (format === 'json') {
      vscode.postMessage({ type: 'save', format, content: L.toJson(textModel) });
    }
  }

  $('namespaceSearch').addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    for (const row of $('namespaceList').children) {
      row.hidden = query !== '' && !(row.dataset.namespace || '(global)').toLowerCase().includes(query);
    }
  });

  /** Source files changed since the analysis: the map is out of date. */
  function showChanged(count) {
    $('reloadMap').disabled = false;
    $('changedText').textContent = `${count} file${count === 1 ? '' : 's'} changed since the analysis, so the map may be out of date.`;
    $('changedBar').hidden = false;
  }

  $('reloadMap').addEventListener('click', () => {
    $('reloadMap').disabled = true;
    vscode.postMessage({ type: 'reloadMap' });
  });
  $('dismissChanged').addEventListener('click', () => {
    $('changedBar').hidden = true;
    vscode.postMessage({ type: 'dismissChanged' });
  });

  $('compare').addEventListener('click', () => vscode.postMessage({ type: 'compare' }));
  $('clearCompare').addEventListener('click', () => clearBaseline());

  $('export').addEventListener('change', (e) => {
    const format = e.target.value;
    e.target.value = '';
    if (format) exportMap(format);
  });

  $('sizeBy').addEventListener('change', (e) => {
    state.sizeBy = e.target.value;
    applyView();
  });

  $('markCycles').addEventListener('change', (e) => {
    state.markCycles = e.target.checked;
    applyMarks();
  });

  $('showViolations').addEventListener('change', (e) => {
    state.showViolations = e.target.checked;
    applyMarks();
  });

  const hubSelect = $('hubMetric');
  for (const metricOption of HUB_METRICS) {
    hubSelect.append(el('option', { value: metricOption.id, textContent: metricOption.label }));
  }
  hubSelect.value = state.hubMetric;
  hubSelect.addEventListener('change', (e) => {
    state.hubMetric = e.target.value;
    if (analysis) renderHubs();
  });

  $('fit').addEventListener('click', () => cy && cy.fit(undefined, 30));
  $('relayout').addEventListener('click', () => cy && layout());

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message) return;
    if (message.type === 'graph') load(message.graph, message.settings, message.rules);
    else if (message.type === 'baseline') showBaseline(message.label, message.graph);
    else if (message.type === 'rules') setRulesInfo(message.rules);
    else if (message.type === 'changed') showChanged(message.count);
  });

  vscode.postMessage({ type: 'ready' });
})();
