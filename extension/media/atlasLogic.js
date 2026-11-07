// Pure analysis logic of the map: cycles, coupling metrics, architecture rules, unused candidates and
// collapsing. No DOM and no Cytoscape, so it runs in the webview (global AtlasLogic) and in Node (tests).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtlasLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ----------------------------------------------------------------- cycles

  /**
   * Strongly connected components with more than one member (Tarjan, without recursion so that
   * large solutions cannot overflow the stack). Every such component is a cycle of dependencies.
   * @param {string[]} ids
   * @param {{source: string, target: string}[]} edges
   * @returns {string[][]} largest first, members sorted
   */
  function stronglyConnected(ids, edges) {
    const known = new Set(ids);
    const out = new Map(ids.map((id) => [id, []]));
    for (const edge of edges) {
      if (edge.source !== edge.target && known.has(edge.source) && known.has(edge.target)) {
        out.get(edge.source).push(edge.target);
      }
    }

    const index = new Map();
    const low = new Map();
    const onStack = new Set();
    const stack = [];
    const result = [];
    let counter = 0;

    for (const start of ids) {
      if (index.has(start)) continue;

      const work = [{ id: start, next: 0 }];
      index.set(start, counter);
      low.set(start, counter);
      counter++;
      stack.push(start);
      onStack.add(start);

      while (work.length > 0) {
        const frame = work[work.length - 1];
        const targets = out.get(frame.id);

        if (frame.next < targets.length) {
          const target = targets[frame.next++];
          if (!index.has(target)) {
            index.set(target, counter);
            low.set(target, counter);
            counter++;
            stack.push(target);
            onStack.add(target);
            work.push({ id: target, next: 0 });
          } else if (onStack.has(target)) {
            low.set(frame.id, Math.min(low.get(frame.id), index.get(target)));
          }
          continue;
        }

        if (low.get(frame.id) === index.get(frame.id)) {
          const component = [];
          let member;
          do {
            member = stack.pop();
            onStack.delete(member);
            component.push(member);
          } while (member !== frame.id);
          if (component.length > 1) result.push(component.sort());
        }

        work.pop();
        if (work.length > 0) {
          const parent = work[work.length - 1].id;
          low.set(parent, Math.min(low.get(parent), low.get(frame.id)));
        }
      }
    }

    return result.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  }

  /**
   * Cycles between types, or between the namespaces or projects the types belong to.
   * For namespaces and projects the edges of the types are merged first.
   * @param {{id: string, namespace?: string, project?: string}[]} nodes
   * @param {{source: string, target: string}[]} edges
   * @param {'type'|'namespace'|'project'} level
   */
  function findCycles(nodes, edges, level) {
    if (level === 'type') {
      return stronglyConnected(nodes.map((n) => n.id), edges);
    }

    const keyOf = new Map(nodes.map((n) => [n.id, level === 'namespace' ? n.namespace || '(global)' : n.project]));
    const keys = [...new Set(keyOf.values())];
    const merged = [];
    for (const edge of edges) {
      const source = keyOf.get(edge.source);
      const target = keyOf.get(edge.target);
      if (source !== undefined && target !== undefined && source !== target) merged.push({ source, target });
    }
    return stronglyConnected(keys, merged);
  }

  // ---------------------------------------------------------------- metrics

  /**
   * Coupling per type. Counts distinct neighbours, not individual edges.
   * instability = fanOut / (fanIn + fanOut): 0 is a stable type that many others rely on,
   * 1 a type that depends on others and nobody depends on.
   * @returns {Map<string, {fanIn: number, fanOut: number, coupling: number, instability: number}>}
   */
  function metrics(nodes, edges) {
    const incoming = new Map(nodes.map((n) => [n.id, new Set()]));
    const outgoing = new Map(nodes.map((n) => [n.id, new Set()]));
    for (const edge of edges) {
      if (edge.source === edge.target || !outgoing.has(edge.source) || !incoming.has(edge.target)) continue;
      outgoing.get(edge.source).add(edge.target);
      incoming.get(edge.target).add(edge.source);
    }

    const result = new Map();
    for (const node of nodes) {
      const fanIn = incoming.get(node.id).size;
      const fanOut = outgoing.get(node.id).size;
      result.set(node.id, {
        fanIn,
        fanOut,
        coupling: fanIn + fanOut,
        instability: fanIn + fanOut === 0 ? 0 : fanOut / (fanIn + fanOut),
      });
    }
    return result;
  }

  /**
   * The types with the highest value of a metric.
   * @param {'fanIn'|'fanOut'|'coupling'|'instability'|'lines'} by
   */
  function topBy(nodes, metricMap, by, count) {
    const value = (node) => (by === 'lines' ? node.lines || 0 : metricMap.get(node.id)[by]);
    return nodes
      .map((node) => ({ node, value: value(node) }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value || a.node.id.localeCompare(b.node.id))
      .slice(0, count);
  }

  // ------------------------------------------------------------ unused code

  /**
   * Types that nothing in the analyzed code refers to. Only candidates: entry points, types that are
   * created through reflection or dependency injection, and serialized types look unused as well.
   */
  function unusedCandidates(nodes, edges) {
    const referenced = new Set();
    for (const edge of edges) {
      if (edge.source !== edge.target) referenced.add(edge.target);
    }
    return nodes
      .filter((node) => !referenced.has(node.id) && !node.id.includes('<top-level statements>'))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  // ------------------------------------------------------------------ rules

  /** Turns a pattern with * (any characters) into a regular expression that has to match completely. */
  function globToRegExp(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped + '$');
  }

  /**
   * Checks the content of an architecture file. Returns the usable part and what is wrong with the rest,
   * so that one mistake does not disable all rules.
   *
   * { "layers": [ { "name": "Domain", "namespaces": ["Shop.Domain*"], "projects": ["Shop.Core"] } ],
   *   "rules":  [ { "from": "Domain", "cannotUse": ["Infrastructure"] },
   *               { "from": "Application", "canOnlyUse": ["Domain"] } ] }
   */
  function parseRules(input) {
    const errors = [];
    const config = { layers: [], rules: [] };

    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      return { config, errors: ['The file has to contain a JSON object with "layers" and "rules".'] };
    }

    const strings = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);
    const names = new Set();

    for (const [index, layer] of (Array.isArray(input.layers) ? input.layers : []).entries()) {
      if (!layer || typeof layer.name !== 'string' || layer.name === '') {
        errors.push(`layers[${index}] needs a "name".`);
        continue;
      }
      const namespaces = strings(layer.namespaces);
      const projects = strings(layer.projects);
      if (namespaces.length === 0 && projects.length === 0) {
        errors.push(`Layer "${layer.name}" needs "namespaces" or "projects".`);
        continue;
      }
      names.add(layer.name);
      config.layers.push({ name: layer.name, namespaces, projects });
    }

    for (const [index, rule] of (Array.isArray(input.rules) ? input.rules : []).entries()) {
      if (!rule || typeof rule.from !== 'string' || !names.has(rule.from)) {
        errors.push(`rules[${index}]: "from" has to be the name of a layer.`);
        continue;
      }
      const cannotUse = strings(rule.cannotUse);
      const canOnlyUse = Array.isArray(rule.canOnlyUse) ? strings(rule.canOnlyUse) : null;
      if (cannotUse.length === 0 && canOnlyUse === null) {
        errors.push(`rules[${index}] (from "${rule.from}") needs "cannotUse" or "canOnlyUse".`);
        continue;
      }
      for (const name of [...cannotUse, ...(canOnlyUse || [])]) {
        if (!names.has(name)) errors.push(`rules[${index}]: unknown layer "${name}".`);
      }
      config.rules.push({ from: rule.from, cannotUse, canOnlyUse });
    }

    return { config, errors };
  }

  /** The layer of every node: the first layer whose patterns match. Nodes without a layer are left out. */
  function assignLayers(nodes, config) {
    const compiled = config.layers.map((layer) => ({
      name: layer.name,
      namespaces: layer.namespaces.map(globToRegExp),
      projects: layer.projects.map(globToRegExp),
    }));

    const result = new Map();
    for (const node of nodes) {
      const layer = compiled.find(
        (l) => l.namespaces.some((r) => r.test(node.namespace || '')) || l.projects.some((r) => r.test(node.project || '')),
      );
      if (layer) result.set(node.id, layer.name);
    }
    return result;
  }

  /**
   * The edges that break a rule. A dependency inside a layer is always allowed, and so is one to a
   * type without a layer.
   * @returns {{source: string, target: string, kind: string, fromLayer: string, toLayer: string, rule: string}[]}
   */
  function findViolations(nodes, edges, config) {
    const layers = assignLayers(nodes, config);
    const violations = [];

    for (const edge of edges) {
      const fromLayer = layers.get(edge.source);
      const toLayer = layers.get(edge.target);
      if (!fromLayer || !toLayer || fromLayer === toLayer) continue;

      for (const rule of config.rules) {
        if (rule.from !== fromLayer) continue;
        let broken = null;
        if (rule.cannotUse.includes(toLayer)) broken = `${fromLayer} cannot use ${toLayer}`;
        else if (rule.canOnlyUse && !rule.canOnlyUse.includes(toLayer)) broken = `${fromLayer} can only use ${rule.canOnlyUse.join(', ') || 'itself'}`;
        if (broken) {
          violations.push({ source: edge.source, target: edge.target, kind: edge.kind, fromLayer, toLayer, rule: broken });
          break;
        }
      }
    }
    return violations;
  }

  // --------------------------------------------------------------- collapse

  /**
   * Merges the nodes that share a key into one node and the edges between them into one edge per
   * (source, target, kind). Edges inside a group disappear. Nodes whose key is null stay as they are.
   * @param {{id: string}[]} nodes
   * @param {{source: string, target: string, kind: string, weight?: number}[]} edges
   * @param {(node: object) => string|null} keyOf
   * @returns {{groups: Map<string, string[]>, edges: object[], representative: Map<string, string>}}
   */
  function collapse(nodes, edges, keyOf) {
    const groups = new Map();
    const representative = new Map();
    for (const node of nodes) {
      const key = keyOf(node);
      if (key === null || key === undefined) {
        representative.set(node.id, node.id);
      } else {
        const id = 'group:' + key;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(node.id);
        representative.set(node.id, id);
      }
    }

    const merged = new Map();
    for (const edge of edges) {
      const source = representative.get(edge.source);
      const target = representative.get(edge.target);
      if (source === undefined || target === undefined || source === target) continue;
      const id = `${source}\u0000${target}\u0000${edge.kind}`;
      const entry = merged.get(id) || { source, target, kind: edge.kind, weight: 0 };
      entry.weight += edge.weight || 1;
      merged.set(id, entry);
    }

    return { groups, edges: [...merged.values()], representative };
  }

  return {
    stronglyConnected,
    findCycles,
    metrics,
    topBy,
    unusedCandidates,
    globToRegExp,
    parseRules,
    assignLayers,
    findViolations,
    collapse,
  };
});
