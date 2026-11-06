/**
 * The JSON document written by the analyzer (see analyzer/Atlas.Analyzer/Model).
 * Property names are camelCase, enum values are lower camelCase strings.
 */
export type NodeKind = 'class' | 'interface' | 'struct' | 'record' | 'enum';

export type EdgeKind = 'inherits' | 'implements' | 'uses';

export interface AtlasNode {
  /** Fully qualified, unique name, e.g. `Shop.Domain.Order`. */
  id: string;
  /** Short display name including generic parameters. */
  name: string;
  kind: NodeKind;
  /** Containing namespace, empty for the global namespace. */
  namespace: string;
  project: string;
  /** Absolute path of the first declaring file. */
  file?: string;
  /** 1-based line of the declaration. */
  line?: number;
  members: number;
  methods: number;
  lines: number;
}

/** Points from the dependent type to the type it depends on. */
export interface AtlasEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  /** How often the relationship occurs. */
  weight: number;
}

export interface AtlasGraph {
  /** The solution or project file that was analyzed. */
  root: string;
  nodes: AtlasNode[];
  edges: AtlasEdge[];
}
