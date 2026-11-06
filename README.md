# DotNet Solution Atlas

A Visual Studio Code extension that turns a .NET solution into a map. It
analyzes the open solution with Roslyn and shows classes, interfaces, structs,
records and enums as nodes, and their relationships (inheritance,
implementation, usage) as connections. The goal is to answer questions such as
"what depends on this type?", "where are the hubs of this codebase?" and "how is
this solution layered?" at a glance.

> Status: early development. The analyzer and the extension skeleton are in
> place; features are added step by step.

## How it works

```
 .sln / .csproj
       |
       v
 analyzer/   Roslyn-based console tool, writes the dependency graph as JSON
       |
       v
 extension/  VS Code extension: runs the analyzer, shows the graph in a webview
```

- `analyzer/` loads the solution with `MSBuildWorkspace`, walks all types that
  are declared in source and emits nodes and edges as JSON.
- `extension/` starts the analyzer, receives the JSON and renders it with
  Cytoscape.js. Clicking a node opens the declaring file.

## Planned features

- Layered layout, so that interfaces and implementations are easy to tell apart
- Filters by project, namespace and type kind
- Focus mode: only the selected type and its neighbours
- Heatmap by coupling to find hubs, and detection of dependency cycles
- Namespaces and projects as visual groups
- Export as SVG or PNG

## Requirements

- Visual Studio Code 1.85 or newer
- .NET SDK 8.0 or newer (needed by the analyzer to load your solution)
- Node.js 20 or newer (only to build the extension)

## Repository layout

| Path         | Content                                   |
| ------------ | ----------------------------------------- |
| `analyzer/`  | .NET console tool (Roslyn)                |
| `extension/` | VS Code extension (TypeScript, webview)   |
