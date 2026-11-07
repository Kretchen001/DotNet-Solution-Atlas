'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../media/atlasLogic.js');

const node = (id, namespace = '', project = 'App', extra = {}) => ({ id, name: id, namespace, project, ...extra });
const edge = (source, target, kind = 'uses', weight = 1) => ({ source, target, kind, weight });

test('stronglyConnected finds a cycle of three and ignores the rest', () => {
  const ids = ['A', 'B', 'C', 'D'];
  const result = logic.stronglyConnected(ids, [edge('A', 'B'), edge('B', 'C'), edge('C', 'A'), edge('C', 'D')]);
  assert.deepEqual(result, [['A', 'B', 'C']]);
});

test('stronglyConnected reports nothing for a chain, a self reference or unknown ids', () => {
  const ids = ['A', 'B'];
  assert.deepEqual(logic.stronglyConnected(ids, [edge('A', 'B'), edge('A', 'A'), edge('B', 'X')]), []);
});

test('stronglyConnected finds several cycles, largest first', () => {
  const ids = ['A', 'B', 'C', 'D', 'E'];
  const edges = [edge('A', 'B'), edge('B', 'A'), edge('C', 'D'), edge('D', 'E'), edge('E', 'C')];
  assert.deepEqual(logic.stronglyConnected(ids, edges), [['C', 'D', 'E'], ['A', 'B']]);
});

test('stronglyConnected handles a very long chain without overflowing the stack', () => {
  const ids = Array.from({ length: 50000 }, (_, i) => 'n' + i);
  const edges = ids.slice(1).map((id, i) => edge(ids[i], id));
  edges.push(edge(ids[ids.length - 1], ids[0]));
  const result = logic.stronglyConnected(ids, edges);
  assert.equal(result.length, 1);
  assert.equal(result[0].length, 50000);
});

test('findCycles merges the types into namespaces and projects', () => {
  const nodes = [node('a', 'Shop.Api', 'Api'), node('b', 'Shop.Domain', 'Core'), node('c', 'Shop.Domain', 'Core'), node('d', 'Shop.Api', 'Api')];
  // Api -> Domain and Domain -> Api, but no type-level cycle.
  const edges = [edge('a', 'b'), edge('c', 'd')];
  assert.deepEqual(logic.findCycles(nodes, edges, 'type'), []);
  assert.deepEqual(logic.findCycles(nodes, edges, 'namespace'), [['Shop.Api', 'Shop.Domain']]);
  assert.deepEqual(logic.findCycles(nodes, edges, 'project'), [['Api', 'Core']]);
});

test('findCycles ignores edges inside one namespace', () => {
  const nodes = [node('a', 'N'), node('b', 'N')];
  assert.deepEqual(logic.findCycles(nodes, [edge('a', 'b'), edge('b', 'a')], 'namespace'), []);
});

test('connectedComponents groups by connection, largest first, and ignores unknown ids', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  const edges = [edge('A', 'B'), edge('C', 'B'), edge('D', 'E'), edge('A', 'X'), edge('F', 'F')];
  assert.deepEqual(logic.connectedComponents(ids, edges), [['A', 'B', 'C'], ['D', 'E'], ['F']]);
  assert.deepEqual(logic.connectedComponents([], edges), []);
});

test('connectedComponents handles a long chain', () => {
  const ids = Array.from({ length: 50000 }, (_, i) => 'n' + i);
  const edges = ids.slice(1).map((id, i) => edge(ids[i], id));
  assert.equal(logic.connectedComponents(ids, edges)[0].length, 50000);
});

test('metrics counts distinct neighbours and the instability', () => {
  const nodes = [node('A'), node('B'), node('C')];
  const edges = [edge('A', 'C', 'uses'), edge('A', 'C', 'calls'), edge('B', 'C'), edge('C', 'A')];
  const m = logic.metrics(nodes, edges);
  assert.deepEqual(m.get('C'), { fanIn: 2, fanOut: 1, coupling: 3, instability: 1 / 3 });
  assert.deepEqual(m.get('A'), { fanIn: 1, fanOut: 1, coupling: 2, instability: 0.5 });
  assert.equal(m.get('B').fanIn, 0);
});

test('metrics gives an isolated type the instability 0', () => {
  const m = logic.metrics([node('A')], []);
  assert.equal(m.get('A').instability, 0);
});

test('topBy sorts by the metric, leaves out zeros and honours the count', () => {
  const nodes = [node('A', '', 'App', { lines: 10 }), node('B', '', 'App', { lines: 50 }), node('C', '', 'App', { lines: 0 })];
  const m = logic.metrics(nodes, [edge('A', 'B'), edge('C', 'B')]);
  assert.deepEqual(logic.topBy(nodes, m, 'fanIn', 5).map((e) => e.node.id), ['B']);
  assert.deepEqual(logic.topBy(nodes, m, 'lines', 1).map((e) => e.node.id), ['B']);
  assert.deepEqual(logic.topBy(nodes, m, 'lines', 5).map((e) => e.value), [50, 10]);
});

test('unusedCandidates lists types without incoming edges, but not top-level statements', () => {
  const nodes = [node('A'), node('B'), node('App.<top-level statements>')];
  const result = logic.unusedCandidates(nodes, [edge('A', 'B'), edge('B', 'B')]);
  assert.deepEqual(result.map((n) => n.id), ['A']);
});

test('findUnused hides framework-wired types and says why', () => {
  const nodes = [
    node('Shop.Plain', 'Shop'),
    node('Shop.MainWindow', 'Shop', 'App', { baseTypes: ['System.Windows.Window'] }),
    node('Shop.Tests', 'Shop', 'App', { attributes: ['Xunit.FactAttribute'] }),
    node('Shop.Program', 'Shop', 'App', { memberDetails: [{ name: 'Main(string[])', kind: 'method', refs: [] }] }),
    node('Shop.Generated.Thing', 'Shop.Generated'),
    node('Shop.Special', 'Shop'),
  ];
  const ignore = logic.mergeIgnore({ namespaces: ['Shop.Generated*'], types: ['Shop.Special'] });
  const { candidates, ignored } = logic.findUnused(nodes, [], ignore);
  assert.deepEqual(candidates.map((n) => n.id), ['Shop.Plain']);
  assert.deepEqual(
    ignored.map((i) => [i.node.id, i.reason]).sort(),
    [
      ['Shop.Generated.Thing', 'namespace Shop.Generated*'],
      ['Shop.MainWindow', 'derives from System.Windows.*'],
      ['Shop.Program', 'entry point Main'],
      ['Shop.Special', 'type Shop.Special'],
      ['Shop.Tests', 'attribute Xunit.*'],
    ],
  );
});

test('mergeIgnore adds settings and rules file to the defaults, which can be switched off', () => {
  const settings = { types: ['A'] };
  const rules = { types: ['B'], attributes: ['My.*'] };
  const withDefaults = logic.mergeIgnore([settings, rules, null]);
  assert.deepEqual(withDefaults.types, ['A', 'B']);
  assert.ok(withDefaults.baseTypes.includes('System.Windows.*'));
  assert.ok(withDefaults.attributes.includes('My.*'));

  const without = logic.mergeIgnore([settings, rules], false);
  assert.deepEqual(without.baseTypes, []);
  assert.deepEqual(without.attributes, ['My.*']);
  assert.deepEqual(logic.mergeIgnore(null, false).types, []);
});

test('findUnused without exceptions equals unusedCandidates', () => {
  const nodes = [node('A', '', 'App', { baseTypes: ['System.Windows.Window'] })];
  assert.equal(logic.findUnused(nodes, [], null).candidates.length, 1);
});

test('findUnused keeps referenced types out in both lists', () => {
  const nodes = [node('A'), node('B', '', 'App', { baseTypes: ['System.Windows.Window'] })];
  const result = logic.findUnused(nodes, [edge('A', 'B')], logic.mergeIgnore(null));
  assert.deepEqual(result.candidates.map((n) => n.id), ['A']);
  assert.equal(result.ignored.length, 0);
});

test('parseRules reads ignoreUnused and reports mistakes in it', () => {
  const ok = logic.parseRules({ ignoreUnused: { baseTypes: ['My.Base*'], types: ['A'] } });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.config.ignoreUnused.baseTypes, ['My.Base*']);
  assert.deepEqual(ok.config.ignoreUnused.attributes, []);

  const bad = logic.parseRules({ ignoreUnused: { baseTypes: 'x', bogus: [] } });
  assert.equal(bad.errors.length, 2);
  assert.equal(logic.parseRules({ ignoreUnused: [] }).errors.length, 1);
  assert.equal(logic.parseRules({ layers: [] }).config.ignoreUnused, null);
});

test('globToRegExp matches completely and treats dots literally', () => {
  const re = logic.globToRegExp('Shop.Domain*');
  assert.ok(re.test('Shop.Domain'));
  assert.ok(re.test('Shop.Domain.Orders'));
  assert.ok(!re.test('ShopXDomain'));
  assert.ok(!re.test('My.Shop.Domain'));
});

const rulesFile = {
  layers: [
    { name: 'Domain', namespaces: ['Shop.Domain*'] },
    { name: 'Infrastructure', namespaces: ['Shop.Infrastructure*'] },
    { name: 'Application', projects: ['Shop.App'] },
  ],
  rules: [
    { from: 'Domain', cannotUse: ['Infrastructure'] },
    { from: 'Application', canOnlyUse: ['Domain'] },
  ],
};

test('parseRules accepts a valid file', () => {
  const { config, errors } = logic.parseRules(rulesFile);
  assert.deepEqual(errors, []);
  assert.equal(config.layers.length, 3);
  assert.equal(config.rules.length, 2);
});

test('parseRules reports mistakes and keeps what is usable', () => {
  const { config, errors } = logic.parseRules({
    layers: [{ name: 'A', namespaces: ['A*'] }, { namespaces: ['x'] }, { name: 'Empty' }],
    rules: [{ from: 'A', cannotUse: ['Missing'] }, { from: 'Nope', cannotUse: ['A'] }, { from: 'A' }],
  });
  assert.equal(config.layers.length, 1);
  assert.equal(config.rules.length, 1);
  assert.equal(errors.length, 5);
});

test('parseRules rejects anything but an object', () => {
  assert.equal(logic.parseRules([]).errors.length, 1);
  assert.equal(logic.parseRules(null).errors.length, 1);
});

test('findViolations flags forbidden and unlisted layer dependencies only', () => {
  const nodes = [
    node('Shop.Domain.Order', 'Shop.Domain', 'Shop.Core'),
    node('Shop.Infrastructure.Db', 'Shop.Infrastructure', 'Shop.Data'),
    node('Shop.App.Service', 'Shop.Application', 'Shop.App'),
    node('Shop.Other', 'Other', 'Other'),
    node('Shop.Domain.Money', 'Shop.Domain', 'Shop.Core'),
  ];
  const edges = [
    edge('Shop.Domain.Order', 'Shop.Infrastructure.Db'), // forbidden
    edge('Shop.Domain.Order', 'Shop.Domain.Money'), // same layer
    edge('Shop.Domain.Order', 'Shop.Other'), // no layer
    edge('Shop.App.Service', 'Shop.Domain.Order'), // allowed
    edge('Shop.App.Service', 'Shop.Infrastructure.Db'), // not in canOnlyUse
    edge('Shop.Infrastructure.Db', 'Shop.Domain.Order'), // no rule for Infrastructure
  ];
  const { config } = logic.parseRules(rulesFile);
  const violations = logic.findViolations(nodes, edges, config);
  assert.deepEqual(
    violations.map((v) => [v.source, v.target, v.rule]),
    [
      ['Shop.Domain.Order', 'Shop.Infrastructure.Db', 'Domain cannot use Infrastructure'],
      ['Shop.App.Service', 'Shop.Infrastructure.Db', 'Application can only use Domain'],
    ],
  );
});

test('assignLayers uses the first matching layer', () => {
  const { config } = logic.parseRules({
    layers: [{ name: 'Specific', namespaces: ['A.B'] }, { name: 'General', namespaces: ['A*'] }],
    rules: [],
  });
  const layers = logic.assignLayers([node('x', 'A.B'), node('y', 'A.C'), node('z', 'Z')], config);
  assert.equal(layers.get('x'), 'Specific');
  assert.equal(layers.get('y'), 'General');
  assert.ok(!layers.has('z'));
});

test('collapse merges nodes into groups and aggregates the edges', () => {
  const nodes = [node('a', 'N1'), node('b', 'N1'), node('c', 'N2'), node('d', 'N3')];
  const edges = [edge('a', 'c', 'uses', 2), edge('b', 'c', 'uses', 3), edge('a', 'b'), edge('c', 'd', 'calls')];
  const result = logic.collapse(nodes, edges, (n) => (n.namespace === 'N3' ? null : n.namespace));

  assert.deepEqual([...result.groups.keys()].sort(), ['group:N1', 'group:N2']);
  assert.deepEqual(result.groups.get('group:N1'), ['a', 'b']);
  assert.equal(result.representative.get('d'), 'd');
  assert.deepEqual(result.edges, [
    { source: 'group:N1', target: 'group:N2', kind: 'uses', weight: 5 },
    { source: 'group:N2', target: 'd', kind: 'calls', weight: 1 },
  ]);
});

test('collapse keeps edges of different kinds apart', () => {
  const nodes = [node('a', 'N1'), node('c', 'N2')];
  const result = logic.collapse(nodes, [edge('a', 'c', 'uses'), edge('a', 'c', 'calls')], (n) => n.namespace);
  assert.equal(result.edges.length, 2);
});

const exportModel = {
  frames: true,
  nodes: [
    { id: 'A.One', label: 'One "x"', namespace: 'A', kind: 'class', project: 'P' },
    { id: 'A.Two', label: 'Two', namespace: 'A', kind: 'interface', project: 'P' },
    { id: 'B.Three', label: 'Three', namespace: '', kind: 'class', project: 'P' },
  ],
  edges: [
    { source: 'A.One', target: 'A.Two', kind: 'implements' },
    { source: 'B.Three', target: 'A.One', kind: 'registers', weight: 2 },
    { source: 'B.Three', target: 'missing', kind: 'uses' },
  ],
};

test('toMermaid groups namespaces into subgraphs and skips unknown targets', () => {
  const text = logic.toMermaid(exportModel);
  assert.match(text, /^flowchart LR\n/);
  assert.match(text, /subgraph g0\["A"\]\n    n0\["One  x "\]\n    n1\["Two"\]\n  end/);
  assert.match(text, /n2\["Three"\]/);
  assert.match(text, /n0 -\.->\|implements\| n1/);
  assert.match(text, /n2 -\.->\|registers\| n0/);
  assert.ok(!text.includes('missing'));
});

test('toMermaid without frames is a flat list', () => {
  assert.ok(!logic.toMermaid({ ...exportModel, frames: false }).includes('subgraph'));
});

test('toDot escapes labels, clusters namespaces and styles kinds', () => {
  const text = logic.toDot(exportModel);
  assert.match(text, /^digraph Atlas \{/);
  assert.match(text, /subgraph cluster_0 \{\n    label="A";/);
  assert.match(text, /n0 \[label="One \\"x\\""\];/);
  assert.match(text, /n0 -> n1 \[label="implements", style=dashed, arrowhead=empty\];/);
  assert.match(text, /\}\n$/);
});

test('toJson contains nodes and edges without positions', () => {
  const data = JSON.parse(logic.toJson(exportModel));
  assert.equal(data.nodes.length, 3);
  assert.deepEqual(data.edges[1], { source: 'B.Three', target: 'A.One', kind: 'registers', weight: 2 });
});

test('toSvg draws frames, edges and escaped labels inside the canvas', () => {
  const svg = logic.toSvg({
    frames: [{ x: 50, y: 25, w: 160, h: 90, label: 'A & B' }],
    nodes: [
      { id: 'a', label: '<One>', x: 0, y: 0, w: 60, h: 24, fill: '#fff', border: '#000' },
      { id: 'b', label: 'Two', x: 100, y: 50, w: 60, h: 24 },
    ],
    edges: [{ source: 'a', target: 'b', kind: 'calls', weight: 1 }, { source: 'a', target: 'zz', kind: 'uses' }],
    colors: { edges: { calls: '#ff8800' } },
  });
  assert.match(svg, /^<svg xmlns=/);
  assert.match(svg, /&lt;One&gt;/);
  assert.match(svg, /A &amp; B/);
  assert.match(svg, /stroke="#ff8800"/);
  assert.equal((svg.match(/<line /g) || []).length, 1);
  assert.match(svg, /marker id="arrow-calls"/);
});

test('toSvg copes with an empty map', () => {
  assert.match(logic.toSvg({ nodes: [], edges: [] }), /<svg [^>]*width="148"/);
});

test('diffGraphs finds added and removed types and dependencies', () => {
  const previous = {
    nodes: [node('A'), node('B'), node('Old')],
    edges: [edge('A', 'B'), edge('A', 'Old'), edge('B', 'A', 'calls', 1)],
  };
  const current = {
    nodes: [node('A'), node('B'), node('New')],
    edges: [edge('A', 'B', 'uses', 5), edge('A', 'New'), edge('B', 'A', 'uses')],
  };

  const diff = logic.diffGraphs(previous, current);
  assert.deepEqual(diff.addedNodes, ['New']);
  assert.deepEqual(diff.removedNodes.map((n) => n.id), ['Old']);
  assert.deepEqual(diff.addedEdges.map((e) => [e.source, e.target, e.kind]), [['A', 'New', 'uses'], ['B', 'A', 'uses']]);
  assert.deepEqual(diff.removedEdges.map((e) => [e.source, e.target, e.kind]), [['A', 'Old', 'uses'], ['B', 'A', 'calls']]);
});

test('diffGraphs ignores a changed weight and reports nothing for equal graphs', () => {
  const graph = { nodes: [node('A'), node('B')], edges: [edge('A', 'B', 'uses', 1)] };
  const same = { nodes: [node('B'), node('A')], edges: [edge('A', 'B', 'uses', 9)] };
  const diff = logic.diffGraphs(graph, same);
  assert.deepEqual([diff.addedNodes, diff.removedNodes, diff.addedEdges, diff.removedEdges], [[], [], [], []]);
});

const fixed = { size: () => ({ w: 100, h: 30 }) };

test('layeredLayout puts a type above the types it depends on', () => {
  const nodes = [node('A'), node('B'), node('C')];
  const pos = logic.layeredLayout(nodes, [edge('A', 'B'), edge('B', 'C'), edge('A', 'C')], fixed);
  assert.ok(pos.get('A').y < pos.get('B').y);
  assert.ok(pos.get('B').y < pos.get('C').y);
});

test('layeredLayout keeps the members of a cycle in one layer', () => {
  const nodes = [node('A'), node('B'), node('C'), node('D')];
  const pos = logic.layeredLayout(nodes, [edge('A', 'B'), edge('B', 'A'), edge('B', 'C'), edge('C', 'D')], fixed);
  assert.equal(pos.get('A').y, pos.get('B').y);
  assert.ok(pos.get('B').y < pos.get('C').y);
});

test('layeredLayout puts unrelated types into the last layer and a lone source right above its target', () => {
  const nodes = [node('Top'), node('Mid'), node('Low'), node('Source'), node('Alone')];
  const pos = logic.layeredLayout(nodes, [edge('Top', 'Mid'), edge('Mid', 'Low'), edge('Source', 'Low')], fixed);
  assert.ok(pos.get('Alone').y > pos.get('Low').y);
  assert.ok(pos.get('Source').y < pos.get('Low').y);
  assert.equal(pos.get('Source').rank, pos.get('Low').rank - 1);
});

test('layeredLayout never lets two types of a layer overlap and wraps wide layers', () => {
  const nodes = Array.from({ length: 40 }, (_, i) => node('N' + i));
  const edges = nodes.slice(1).map((n) => edge('N0', n.id));
  const pos = logic.layeredLayout(nodes, edges, { ...fixed, maxRowWidth: 600 });
  const boxes = [...pos.values()];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const apart = Math.abs(boxes[i].x - boxes[j].x) >= 100 || Math.abs(boxes[i].y - boxes[j].y) >= 30;
      assert.ok(apart, `${i} and ${j} overlap`);
    }
  }
  const widest = Math.max(...boxes.map((b) => Math.abs(b.x))) * 2 + 100;
  assert.ok(widest <= 600 + 1, `rows are at most 600 wide, got ${widest}`);
});

test('layeredLayout keeps the types of a group next to each other', () => {
  const nodes = ['a1', 'b1', 'a2', 'b2', 'a3'].map((id) => node(id, id[0]));
  const edges = nodes.map((n) => edge('root', n.id));
  const all = [node('root', 'r'), ...nodes];
  const pos = logic.layeredLayout(all, edges, { ...fixed, groupOf: (n) => n.namespace });
  const order = nodes.map((n) => n.id).sort((x, y) => pos.get(x).x - pos.get(y).x).map((id) => id[0]).join('');
  assert.ok(order === 'aaabb' || order === 'bbaaa', order);
});

test('layeredLayout is deterministic and handles an empty graph', () => {
  const nodes = Array.from({ length: 30 }, (_, i) => node('N' + i));
  const edges = nodes.slice(1).map((n, i) => edge(nodes[(i * 7) % 30].id, n.id));
  const a = [...logic.layeredLayout(nodes, edges, fixed)];
  const b = [...logic.layeredLayout(nodes, edges, fixed)];
  assert.deepEqual(a, b);
  assert.equal(logic.layeredLayout([], [], fixed).size, 0);
});

test('layeredLayout copes with a thousand types and five thousand edges quickly', () => {
  const nodes = Array.from({ length: 1000 }, (_, i) => node('N' + i, 'ns' + (i % 40)));
  let seed = 7;
  const next = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const edges = [];
  for (let k = 0; k < 5000; k++) edges.push(edge('N' + Math.floor(next() * 1000), 'N' + Math.floor(next() * 1000)));
  const started = Date.now();
  const pos = logic.layeredLayout(nodes, edges, { ...fixed, groupOf: (n) => n.namespace });
  assert.equal(pos.size, 1000);
  assert.ok(Date.now() - started < 3000, `took ${Date.now() - started} ms`);
});
