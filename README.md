# DotNet Solution Atlas

A Visual Studio Code extension that turns a .NET solution into a map. It
analyzes the open solution (C# and Visual Basic, also mixed) with Roslyn and
shows classes, interfaces, structs, records, enums and delegates as nodes, and their relationships (inheritance,
implementation, usage) as connections. The goal is to answer questions such as
"what depends on this type?", "where are the hubs of this codebase?" and "how is
this solution layered?" at a glance.

> Status: early development. Analyzer, extension and map view are written but
> have not been run against a real solution yet; expect rough edges.

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

## Try it

1. Open the repository root in VS Code.
2. In `extension/`, run `npm install`.
3. Press F5 to start an Extension Development Host.
4. Run **DotNet Solution Atlas: Open sample map** from the command palette.
   The sample works without the .NET SDK.

To analyze a real solution, build the analyzer once (`npm run build:analyzer`
in `extension/`), open a folder that contains a `.sln`, `.slnx`, `.csproj` or
`.vbproj`, and run **DotNet Solution Atlas: Open map of the solution**.

The analyzer can also be used on its own:

```
dotnet run --project analyzer/Atlas.Analyzer -- path/to/Your.sln --out graph.json
```

## Using the map

- Arrows point from a type to the types it depends on.
- Colour shows the kind of type. Relationships:
  - solid line with a filled head: inheritance
  - dashed line: interface implementation
  - thin grey line: a type is used (signatures, `new`, casts, `typeof`,
    attributes, generic arguments and constraints, inferred `var` types)
  - orange dotted line: a method, constructor, operator or delegate is called,
    including static helpers and extension methods
  - purple dotted line: a property, indexer, field or event is accessed
- Each kind of relationship can be switched on and off in the "Relationships"
  filter. All of them are shown by default; switch some off if the map gets
  too busy.
- "Groups" lists the connected groups of the visible types and the types that
  have no relationship at all. Click a group to zoom to it and list its
  members. Together with the filters this shows which parts of the code are
  cut off from the rest, for example after hiding a logging interface.
- Code in top-level statements (`Program.cs` without a class) appears as a
  node of its own.
- Click a type to see its neighbours, double-click to open it in the editor.
- Filter by type kind and project, search by name, or switch on
  "Focus on selection" to see only a type and its direct neighbours.

## Supported languages

C# and Visual Basic, in the same solution if needed. F# is not supported,
because Roslyn does not analyze it. A Visual Basic module is shown as a
static class; the compiler-generated `My` namespace is left out.

In a solution that mixes both, relationships across the languages are shown
like any other, and a "Languages" filter appears so that the C# and the Visual
Basic part can be looked at separately.

## Requirements

- Visual Studio Code 1.85 or newer
- .NET SDK 8.0 or newer (needed by the analyzer to load your solution)
- Node.js 20 or newer (only to build the extension)

## Repository layout

| Path         | Content                                   |
| ------------ | ----------------------------------------- |
| `analyzer/`  | .NET console tool (Roslyn)                |
| `extension/` | VS Code extension (TypeScript, webview)   |
