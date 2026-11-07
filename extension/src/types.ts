/**
 * The JSON document written by the analyzer (see analyzer/Atlas.Analyzer/Model).
 * Property names are camelCase, enum values are lower camelCase strings.
 */
export type NodeKind = 'class' | 'interface' | 'struct' | 'record' | 'enum' | 'delegate';

export type EdgeKind = 'inherits' | 'implements' | 'uses' | 'calls' | 'accesses' | 'registers' | 'events' | 'annotated';

/** What a member calls, accesses or uses. `member` is empty for a plain use of a type. */
export interface AtlasMemberRef {
  target: string;
  member?: string;
  kind: 'calls' | 'accesses' | 'uses' | 'events' | 'annotated';
}

/** A member of a type with the places in the solution it refers to. */
export interface AtlasMember {
  name: string;
  kind: string;
  file?: string;
  line?: number;
  refs: AtlasMemberRef[];
}

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
  /** True for static classes. */
  isStatic?: boolean;
  /** Language of the declaring project. */
  language?: 'csharp' | 'visualbasic';
  /** The members with their references; missing in data of older analyzers. */
  memberDetails?: AtlasMember[];
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
