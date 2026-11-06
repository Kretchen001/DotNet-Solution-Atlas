// Webview script: renders the graph with Cytoscape.js and talks to the extension.
// Globals provided by the scripts loaded before this one: cytoscape (with the dagre layout registered).
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();

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

  const state = {
    kinds: new Set(KINDS.map((k) => k.id)),
    edgeKinds: new Set(EDGE_KINDS.map((k) => k.id)),
    projects: new Set(),
    query: '',
    focus: false,
    selected: null,
  };

  let cy = null;
  let lastVisibleKey = '';

  const $ = (id) => document.getElementById(id);

  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }

  function css(name, fallback) {
    return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
  }

  // ---------------------------------------------------------------- loading

  function load(graph, settings) {
    state.selected = null;
    state.projects = new Set(graph.nodes.map((n) => n.project));
    lastVisibleKey = '';

    $('root').textContent = graph.root.split(/[\\/]/).pop();
    $('empty').hidden = graph.nodes.length > 0;

    buildFilters(graph);
    buildGraph(graph, settings);
    applyView();
    showDetails(null);
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

    cy = cytoscape({
      container: $('cy'),
      elements: [
        ...graph.nodes.map((n) => ({ group: 'nodes', data: { ...n, label: n.name } })),
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
          selector: 'node',
          style: {
            label: 'data(label)',
            shape: 'round-rectangle',
            width: 'label',
            height: 30,
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
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': accent } },
        { selector: '.faded', style: { opacity: 0.15 } },
        { selector: '.hidden', style: { display: 'none' } },
      ],
    });

    cy.on('tap', 'node', (event) => select(event.target.id()));
    cy.on('tap', (event) => {
      if (event.target === cy) select(null);
    });
    cy.on('dbltap', 'node', (event) => openNode(event.target));
  }

  function select(id) {
    state.selected = id;
    cy.elements().unselect();
    const node = id ? cy.getElementById(id) : null;
    if (node && node.nonempty()) node.select();
    applyView();
    showDetails(node && node.nonempty() ? node : null);
  }

  /** Applies filters, search and focus. Only runs the layout if the set of visible nodes changed. */
  function applyView() {
    if (!cy) return;

    const query = state.query.trim().toLowerCase();
    const selected = state.selected ? cy.getElementById(state.selected) : null;
    const hasSelection = selected !== null && selected.nonempty();
    const neighbourhood = hasSelection ? selected.closedNeighborhood() : null;

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const visible =
          state.kinds.has(node.data('kind')) &&
          state.projects.has(node.data('project')) &&
          (!state.focus || !neighbourhood || neighbourhood.contains(node));
        node.toggleClass('hidden', !visible);
      });

      cy.edges().forEach((edge) => {
        edge.toggleClass(
          'hidden',
          !state.edgeKinds.has(edge.data('kind')) || edge.source().hasClass('hidden') || edge.target().hasClass('hidden'),
        );
      });

      cy.elements().removeClass('faded');
      const shown = cy.elements().not('.hidden');

      if (query) {
        cy.nodes().not('.hidden').forEach((node) => {
          if (!node.id().toLowerCase().includes(query)) node.addClass('faded');
        });
      } else if (hasSelection && !state.focus) {
        shown.not(neighbourhood).addClass('faded');
      }
    });

    const visibleKey = cy.elements().not('.hidden').map((e) => e.id()).sort().join('|');
    if (visibleKey !== lastVisibleKey) {
      lastVisibleKey = visibleKey;
      layout();
      updateGroups();
    }
  }

  function layout() {
    cy.elements().not('.hidden').layout({
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

  // ----------------------------------------------------------------- groups

  /**
   * Lists the connected groups of the visible types, largest first, and the types that have no
   * visible relationship at all. A group that is cut off from the rest shows up as its own entry.
   */
  function updateGroups() {
    const box = $('groups');
    box.replaceChildren();

    const components = cy.elements().not('.hidden').components()
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
    const link = el('a', { textContent: label, tabIndex: 0, role: 'link' });
    link.addEventListener('click', () => focusGroup(label, nodes));
    link.addEventListener('keydown', (e) => { if (e.key === 'Enter') focusGroup(label, nodes); });
    return el('li', {}, link, el('span', { className: 'edge', textContent: `${nodes.length} types` }));
  }

  /** Fades everything except the group, zooms to it and lists its members. */
  function focusGroup(label, nodes) {
    select(null);
    cy.elements().not('.hidden').addClass('faded');
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
      const link = el('a', { textContent: node.data('name'), tabIndex: 0, role: 'link' });
      link.addEventListener('click', () => select(node.id()));
      link.addEventListener('keydown', (e) => { if (e.key === 'Enter') select(node.id()); });
      list.append(el('li', {}, link, el('span', { className: 'edge', textContent: node.data('project') })));
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

    const dependsOn = node.outgoers('edge').not('.hidden');
    const usedBy = node.incomers('edge').not('.hidden');

    box.append(
      el('p', { className: 'title', textContent: node.data('name') }),
      el('p', { className: 'sub', textContent: `${node.data('isStatic') ? 'static ' : ''}${node.data('kind')} in ${node.data('namespace') || '(global namespace)'}` }),
      el('p', { className: 'sub', textContent: node.data('project') }),
      el('div', { className: 'metrics' },
        metric('Depends on', dependsOn.length),
        metric('Used by', usedBy.length),
        metric('Methods', node.data('methods')),
        metric('Lines', node.data('lines')),
      ),
    );

    const open = el('button', { textContent: 'Open in editor', disabled: !node.data('file') });
    open.addEventListener('click', () => openNode(node));
    box.append(open);

    box.append(el('h3', { textContent: 'Depends on' }), linkList(dependsOn, 'target'));
    box.append(el('h3', { textContent: 'Used by' }), linkList(usedBy, 'source'));
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
      const link = el('a', { textContent: cy.getElementById(id).data('name'), tabIndex: 0, role: 'link' });
      link.addEventListener('click', () => select(id));
      link.addEventListener('keydown', (e) => { if (e.key === 'Enter') select(id); });
      list.append(el('li', {}, link, el('span', { className: 'edge', textContent: edge.data('kind') })));
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

  $('fit').addEventListener('click', () => cy && cy.fit(undefined, 30));
  $('relayout').addEventListener('click', () => cy && layout());

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'graph') load(event.data.graph, event.data.settings);
  });

  vscode.postMessage({ type: 'ready' });
})();
