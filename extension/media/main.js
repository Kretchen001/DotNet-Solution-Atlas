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
  const MAX_EXTRA_HEIGHT = 30;

  const state = {
    kinds: new Set(KINDS.map((k) => k.id)),
    languages: new Set(LANGUAGES.map((l) => l.id)),
    edgeKinds: new Set(EDGE_KINDS.map((k) => k.id)),
    projects: new Set(),
    query: '',
    focus: false,
    namespaces: 'off', // off | grouped | nested
    collapse: 'none', // none | namespace | project
    expanded: new Set(), // "namespace:Shop.Api": groups the user opened while collapsing
    sizeBy: 'uniform', // uniform | coupling | fanIn | lines
    markCycles: true,
    showViolations: true,
    hubMetric: 'coupling',
    rulesInfo: null, // { file?, error? } from the extension
    rules: null, // result of AtlasLogic.parseRules
    selected: null,
  };

  let cy = null;
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
    return cy.nodes('[!isNamespace][!isGroup]');
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
    state.selected = null;
    state.expanded = new Set();
    // The settings only give the starting values; the toolbar can change them afterwards.
    const grouping = settings && settings.namespaceGrouping;
    state.namespaces = ['off', 'grouped', 'nested'].includes(grouping) ? grouping : 'off';
    $('namespaces').value = state.namespaces;
    state.projects = new Set(graph.nodes.map((n) => n.project));
    lastVisibleKey = '';

    setRulesInfo(rules, false);

    $('root').textContent = graph.root.split(/[\\/]/).pop();
    $('empty').hidden = graph.nodes.length > 0;

    buildFilters(graph);
    buildGraph(graph, settings);
    applyView();
    showDetails(null);
  }

  function setRulesInfo(info, apply = true) {
    state.rulesInfo = info || null;
    state.rules = info && info.data !== undefined ? L.parseRules(info.data) : null;
    if (apply && cy) {
      lastVisibleKey = '';
      applyView();
    }
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
    const warnColor = css('--vscode-charts-red', '#f14c4c');
    const panel = css('--vscode-editorWidget-background', '#252526');

    cy = cytoscape({
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
            'curve-style': 'bezier',
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
    shown().layout({
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 24,
      rankSep: 70,
      padding: 30,
      animate: false,
      fit: true,
    }).run();
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
    const edges = cy.edges().not('.synthetic').not('.hidden').map((e) => ({
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
      unused: L.unusedCandidates(nodes, edges),
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
    $('unusedCount').textContent = analysis.unused.length === 0 ? '' : String(analysis.unused.length);

    if (analysis.unused.length === 0) {
      box.append(el('p', { className: 'hint', textContent: 'Every type is referenced.' }));
      return;
    }

    box.append(el('p', {
      className: 'hint',
      textContent: 'Nothing in the analyzed code refers to these. Entry points and types used through reflection, DI or serialization look the same.',
    }));

    const limit = 100;
    const list = el('ul', { className: 'links' });
    for (const node of analysis.unused.slice(0, limit)) {
      list.append(el('li', {}, link(node.name, () => select(node.id)), el('span', { className: 'edge', textContent: node.kind })));
    }
    box.append(list);
    if (analysis.unused.length > limit) {
      box.append(el('p', { className: 'hint', textContent: `... and ${analysis.unused.length - limit} more` }));
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

    const components = shown().not('.namespace').components()
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

    const open = el('button', { textContent: 'Open in editor', disabled: !node.data('file') });
    open.addEventListener('click', () => openNode(node));
    box.append(open);

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

    const expand = el('button', { textContent: 'Expand' });
    expand.addEventListener('click', () => expandGroup(node));
    box.append(expand);

    box.append(el('h3', { textContent: 'Depends on' }), linkList(node.outgoers('edge'), 'target'));
    box.append(el('h3', { textContent: 'Used by' }), linkList(node.incomers('edge'), 'source'));

    box.append(el('h3', { textContent: 'Types' }));
    const list = el('ul', { className: 'links' });
    for (const id of [...members].sort().slice(0, 300)) {
      list.append(el('li', {}, link(nameOf(id), () => select(id))));
    }
    box.append(list);
  }

  const REF_VERBS = { calls: 'calls', accesses: 'accesses', uses: 'uses' };

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
    else if (message.type === 'rules') setRulesInfo(message.rules);
  });

  vscode.postMessage({ type: 'ready' });
})();
