<!-- Maintainers: keep all five language sections in sync, in this order: English, Deutsch, 中文, Русский, Español. -->

# DotNet Solution Atlas

<img src="extension/icon.png" alt="DotNet Solution Atlas logo" width="96" align="right">

- [English](#english)
- [Deutsch](#deutsch)
- [中文](#中文)
- [Русский](#русский)
- [Español](#español)

---

<a id="english"></a>

## English

A Visual Studio Code extension that turns a .NET solution into a map. It
analyzes the open solution (C# and Visual Basic, also mixed) with Roslyn and
shows classes, interfaces, structs, records, enums and delegates as nodes, and
their relationships (inheritance, implementation, usage) as connections. The
goal is to answer questions such as "what depends on this type?", "where are
the hubs of this codebase?" and "how is this solution layered?" at a glance.

> Status: early development (version 0.1). Expect rough edges. Visual Basic
> support is new and less tested.

### How it works

```
 .sln / .csproj / .vbproj
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

### Features

- Types: classes, interfaces, structs, records, enums, delegates, and
  top-level statements (`Program.cs` without a class) as a node of their own
- Relationships: inheritance, implementation, use of types, method calls,
  property/field access, dependency injection registrations, events and
  attributes, each of them can be switched on and off
- Layered layout, so that interfaces and implementations are easy to tell apart
- Filters by relationship, type kind, project, language and namespace (each
  list has "all / none"); search by name
- Focus mode: only the selected type and its neighbours
- Group by namespace: dashed frames around the types of each namespace, optionally nested (Off, Grouped, Nested)
- Collapse namespaces or projects into one node each, to get an overview of
  large solutions
- Analysis: dependency cycles between types, namespaces and projects (marked in
  red), a hub ranking (coupling, fan-in, fan-out, instability, size),
  candidates for unused types, and node height by coupling, usage or size
- Architecture rules: layers and what they may use, defined in `.atlas.json`;
  violations are drawn in red and listed
- Members: the details of a type list its members and what each of them calls,
  accesses or uses
- Details pane with metrics, and jump to the source file
- Groups: connected groups of types and types without any relationship, to
  find parts of the code that are cut off from the rest
- Export of the map as shown: PNG, SVG, Mermaid, Graphviz DOT or JSON
- Comparison with a Git commit, branch or tag: new types and dependencies in
  green, removed ones as red dashed ghosts, and a list of the changes (useful
  to review a pull request)

### Try it

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

### Using the map

The interface of the extension is in English.

- Arrows point from a type to the types it depends on.
- Colour shows the kind of type. Relationships:
  - solid line with a filled head: inheritance
  - dashed line: interface implementation
  - thin grey line: a type is used (signatures, `new`, casts, `typeof`,
    attributes, generic arguments and constraints, inferred `var` types)
  - orange dotted line: a method, constructor, operator or delegate is called,
    including static helpers and extension methods
  - purple dotted line: a property, indexer or field is accessed
  - green dashed line: a type is registered with the dependency injection
    container (`services.AddScoped<IOrders, Orders>()`, `AddHostedService<T>()`,
    ...); the arrow points at the service and at the implementation
  - red dotted line: an event is subscribed to, unsubscribed from or raised
  - yellow dashed line: a type is marked with an attribute class of the solution
  - blue dashed line: a type is named in a XAML file (element, `{x:Type}`, `{x:Static}`, loaded XAML file); the arrow starts at the type of that file
- Each kind of relationship can be switched on and off in the "Relationships"
  filter. All of them are shown by default; switch some off if the map gets
  too busy.
- "Groups" lists the connected groups of the visible types and the types that
  have no relationship at all. Click a group to zoom to it and list its
  members. Together with the filters this shows which parts of the code are
  cut off from the rest, for example after hiding a logging interface.
- Click a type to see its neighbours, double-click to open it in the editor.
- Filter by type kind, project and language, search by name, or switch on
  "Focus on selection" to see only a type and its direct neighbours.
- Namespaces can be switched off one by one in the "Namespaces" list of the
  sidebar; the box above the list narrows it. Every filter list has "all" and
  "none" in its heading; with a narrowed namespace list they apply to the
  namespaces that are listed.
- "Focus in map" in the details on the right centres the map on the selected
  type and its neighbours, for example after you picked it from a list on the
  left.
- "Export…" saves the map as it is shown (filters, collapsed groups and
  namespace frames included) as PNG, SVG, Mermaid, Graphviz DOT or JSON.
- "Compare with Git…" asks for a branch, tag or commit and analyzes that
  revision in a temporary checkout (your working directory is not touched, the
  packages are restored there). New types and dependencies get a green border
  or line, removed ones are drawn again as red dashed ghosts, and the sidebar
  lists the changes. "Clear comparison" removes the marks. Needs a Git
  repository and access to the package sources.

### Architecture rules

Architecture rules describe how the solution is *meant* to be built; the map
then shows where the code does something else. A typical example: the domain
layer must not know the database layer. Nothing stops a `using
Shop.Infrastructure` from slipping into a domain class, but with a rule that
dependency is drawn in red and listed.

**Getting started**

1. Press "Create rules file" under "Architecture rules" in the sidebar of the
   map. This creates `.atlas.json` next to the solution, with the most common
   namespace prefix of your code as a starting point.
2. Adjust the layers to your namespaces or projects and add rules.
3. Press "Reload" in the map. The check runs at once, no new analysis is needed.

The file is looked up next to the solution first, then in the workspace
folders. The file name can be changed with the setting `dotnetAtlas.rulesFile`.
The sample map ("Open sample map") has rules of its own, so you can see a
violation without any setup.

**The file**

```json
{
  "layers": [
    { "name": "Domain",         "namespaces": ["Shop.Domain", "Shop.Domain.*"] },
    { "name": "Application",    "namespaces": ["Shop.Application", "Shop.Application.*"] },
    { "name": "Infrastructure", "projects": ["Shop.Infrastructure"] },
    { "name": "Web",            "projects": ["Shop.Web"] }
  ],
  "rules": [
    { "from": "Domain",         "canOnlyUse": [] },
    { "from": "Application",    "canOnlyUse": ["Domain"] },
    { "from": "Infrastructure", "cannotUse": ["Web"] }
  ]
}
```

*Layers* group the types of the solution:

- `name` is how rules refer to the layer.
- `namespaces` and `projects` are lists of patterns. A type belongs to the
  layer if its namespace or the name of its project (without `.csproj`)
  matches one of them. Use either list or both.
- In a pattern `*` stands for any characters, dots included; everything else is
  literal and case-sensitive, and the pattern has to match the whole name.
  `Shop.Domain*` therefore also matches `Shop.DomainTools`. To match the
  namespace and everything below it, and nothing else, write both
  `Shop.Domain` and `Shop.Domain.*`.
- If several layers match, the first one in the file wins. Put the specific
  layers before the general ones.

*Rules* limit what a layer may use:

- `from` is the layer the rule is about.
- `cannotUse` lists layers that must not be used.
- `canOnlyUse` lists the only layers that may be used. An empty list means
  "none": the layer may not depend on any other layer.
- A layer can have several rules, and a rule can have both lists.
- A rule restricts the dependencies that *leave* a layer. To say "nobody but
  Application may use Infrastructure", write rules for the other layers
  (`cannotUse` or `canOnlyUse`), not for Infrastructure.

**What counts as a violation**

- A relationship from a type of layer A to a type of layer B that a rule of A
  forbids. Every kind of relationship counts: inheritance, use of a type,
  calls, accesses, registrations, events and attributes.
- Always allowed: dependencies inside one layer, dependencies from or to types
  that belong to no layer, and layers without a rule.
- The check works on what the filters let through. If you hide "Uses types" or
  a project, the violations that consist of those relationships or types are
  gone as well. Switch all relationships on for a complete check.
- Collapsing namespaces or projects changes only the drawing; the rules are
  checked on the types.

**In the map**

- Violating relationships are drawn thick and red. "Mark rule violations"
  under "Analysis" switches the marking off.
- "Architecture rules" in the sidebar shows how many layers there are, how
  many types were assigned to a layer (a low number usually means that the
  patterns do not match your namespaces), and every violation with the rule
  it breaks. Click an entry to find it in the map.
- Mistakes in the file (an unknown layer name, a layer without patterns, a rule
  without `cannotUse` and `canOnlyUse`) are listed there; the rest of the file
  still applies.

**Tips**

- Start with the one or two rules that matter most, for example "Domain can
  only use Domain", and add more when those are clean.
- The place where the application is put together (`Program.cs`, a startup
  class) legitimately knows all layers, and registrations with the dependency
  injection container count as relationships. Give that code a layer without
  rules, or leave it out.
- Existing violations are not a reason to give up on a rule: the number in the
  sidebar shows whether it goes down over time. Together with "Compare with
  Git…" you can also see which violations a branch introduces.

### Keeping the map up to date

The map is a snapshot. While it is open, the extension watches the source files
of the solution (`.cs`, `.vb`, project files, `.xaml`, `.axaml`; not `bin`,
`obj` or `node_modules`). After a change a bar appears above the toolbar with the
number of changed files. "Reload map" analyzes the solution again (also
available as the command "Analyze the solution of the open map again"),
"Dismiss" hides the bar. A reload starts with the default filters and clears a
comparison with Git.

### Unused types

"Unused candidates" in the sidebar lists types that nothing in the analyzed
code refers to. They are only candidates: a type that a framework creates by
itself has no reference in the code and looks unused. Typical cases are WPF
windows and controls that are only wired up in XAML, controllers, hosted
services, test classes and types that are created through reflection or
dependency injection.

The following are therefore left out by default, and the list says how many
types were hidden and why:

- types derived from WPF, Avalonia, WinUI, MAUI or Xamarin.Forms classes,
  ASP.NET Core controllers, Razor pages, Blazor components, SignalR hubs,
  hosted services and Windows services
- types with test or MEF attributes (xUnit, NUnit, MSTest, `System.ComponentModel.Composition`)
- types with a `Main` method

Add your own exceptions under `ignoreUnused` in the rules file (patterns work
like the layer patterns, `*` matches any characters). A file may contain only
this part. `types` match the full name, `baseTypes` the base classes and
interfaces (also those of the framework, as full names without type arguments),
`attributes` the attribute classes on the type and its members.

```json
{
  "ignoreUnused": {
    "namespaces": ["Shop.Generated*"],
    "types": ["Shop.Api.Startup"],
    "baseTypes": ["Shop.Plugins.IPlugin"],
    "attributes": ["Shop.Serialization.*"]
  }
}
```

The checkbox "Apply exceptions" switches all exceptions off.

**XAML.** The analyzer also reads the `.xaml` and `.axaml` files of the
projects. A type that a XAML file names (as an element such as
`<local:OrderView/>`, in `{x:Type}`, `{x:Static}`, a markup extension, an
attached property, or as the target of a style or template) is referenced by
the type of that file (`x:Class`) through the relationship "XAML references".
A window started through `StartupUri` and merged resource dictionaries count
as well; resource dictionaries are attributed to the `Application` class.
Not detected are references that only exist at runtime: a window opened from
a string, bindings by property name, a `DataContext` that is set in code.
Set `dotnetAtlas.analyzeXaml` to `false` to skip the XAML files.

**Global exceptions.** The setting `dotnetAtlas.ignoreUnused` takes the same
keys as the rules file and applies to all solutions. With
`dotnetAtlas.ignoreUnusedDefaults` set to `false` the built-in exceptions are
dropped. Built-in exceptions, settings and rules file are added together.

### Supported languages

C# and Visual Basic, in the same solution if needed. F# is not supported,
because Roslyn does not analyze it. A Visual Basic module is shown as a
static class; the compiler-generated `My` namespace is left out.

In a solution that mixes both, relationships across the languages are shown
like any other, and a "Languages" filter appears so that the C# and the Visual
Basic part can be looked at separately.

### Settings

| Setting                    | Default  | Meaning                                                                  |
| -------------------------- | -------- | ------------------------------------------------------------------------ |
| `dotnetAtlas.dotnetPath`   | `dotnet` | Path or name of the dotnet executable used to run the analyzer           |
| `dotnetAtlas.analyzerPath` | empty    | Path to `Atlas.Analyzer.dll`; empty uses the analyzer bundled with the extension |
| `dotnetAtlas.zoomSpeed`    | `1`      | Speed of zooming with the mouse wheel (0.1 to 10), applies to the next map |
| `dotnetAtlas.namespaceGrouping` | `off` | Namespace frames when a map opens: `off`, `grouped` or `nested` (changeable in the toolbar) |
| `dotnetAtlas.rulesFile` | `.atlas.json` | Name of the architecture rules file, looked for next to the solution and in the workspace folders |

### Requirements

- Visual Studio Code 1.85 or newer
- .NET SDK 8.0 or newer (needed by the analyzer to load your solution)
- Node.js 20 or newer (only to build the extension)

### Repository layout

| Path         | Content                                 |
| ------------ | --------------------------------------- |
| `analyzer/`  | .NET console tool (Roslyn) and its tests |
| `extension/` | VS Code extension (TypeScript, webview) |

### License

MIT, see [LICENSE](LICENSE). Free to use, modify and distribute. The third-party components (Cytoscape.js, dagre, cytoscape-dagre, Roslyn, MSBuild Locator) are MIT-licensed as well.

[Back to the top](#dotnet-solution-atlas)

---

<a id="deutsch"></a>

## Deutsch

Eine Visual-Studio-Code-Erweiterung, die eine .NET-Solution als Karte
darstellt. Sie analysiert die geöffnete Solution (C# und Visual Basic, auch
gemischt) mit Roslyn und zeigt Klassen, Interfaces, Structs, Records, Enums und
Delegates als Knoten und ihre Beziehungen (Vererbung, Implementierung,
Verwendung) als Verbindungen. Ziel ist es, auf einen Blick Fragen zu
beantworten wie „Was hängt von diesem Typ ab?“, „Wo sind die Knotenpunkte
dieser Codebasis?“ und „Wie ist diese Solution geschichtet?“.

> Status: frühe Entwicklung (Version 0.1). Es gibt noch Ecken und Kanten. Die
> Unterstützung für Visual Basic ist neu und weniger getestet.

### Wie es funktioniert

```
 .sln / .csproj / .vbproj
       |
       v
 analyzer/   Konsolenprogramm auf Roslyn-Basis, schreibt den Abhängigkeitsgraphen als JSON
       |
       v
 extension/  VS-Code-Erweiterung: startet den Analyzer, zeigt den Graphen in einer Webview
```

- `analyzer/` lädt die Solution mit `MSBuildWorkspace`, durchläuft alle im
  Quellcode deklarierten Typen und gibt Knoten und Kanten als JSON aus.
- `extension/` startet den Analyzer, empfängt das JSON und stellt es mit
  Cytoscape.js dar. Ein Klick auf einen Knoten öffnet die Datei, in der der Typ
  deklariert ist.

### Funktionen

- Typen: Klassen, Interfaces, Structs, Records, Enums, Delegates und
  Top-Level-Statements (`Program.cs` ohne Klasse) als eigener Knoten
- Beziehungen: Vererbung, Implementierung, Verwendung von Typen, Methodenaufrufe,
  Property-/Feldzugriffe, Registrierungen für Dependency Injection, Events und
  Attribute, jede Art lässt sich einzeln ein- und ausschalten
- Geschichtetes Layout, damit sich Interfaces und Implementierungen gut
  unterscheiden lassen
- Filter nach Beziehung, Typart, Projekt, Sprache und Namespace (jede Liste hat
  „all / none“); Suche nach Namen
- Fokusmodus: nur der gewählte Typ und seine Nachbarn
- Nach Namespace gruppieren: gestrichelte Rahmen um die Typen jedes Namespace, auch verschachtelt (Off, Grouped, Nested)
- Namespaces oder Projekte zu je einem Knoten zusammenfassen, um große
  Solutions zu überblicken
- Analyse: Abhängigkeitszyklen zwischen Typen, Namespaces und Projekten (rot
  markiert), Ranking der Knotenpunkte (Kopplung, Fan-in, Fan-out, Instabilität,
  Größe), Kandidaten für ungenutzte Typen und Knotenhöhe nach Kopplung,
  Nutzung oder Größe
- Architekturregeln: Schichten und was sie verwenden dürfen, definiert in
  `.atlas.json`; Verstöße werden rot gezeichnet und aufgelistet
- Member: Die Details eines Typs listen seine Member und was jeder davon
  aufruft, anspricht oder verwendet
- Detailbereich mit Kennzahlen und Sprung zur Quelldatei
- Gruppen: zusammenhängende Gruppen von Typen und Typen ohne jede Beziehung, um
  vom Rest abgeschnittene Teile des Codes zu finden
- Export der Karte, wie sie gerade angezeigt wird: PNG, SVG, Mermaid, Graphviz DOT oder JSON
- Vergleich mit einem Git-Commit, Branch oder Tag: neue Typen und Abhängigkeiten
  grün, entfernte als rote gestrichelte Geister, dazu eine Liste der Änderungen
  (nützlich, um einen Pull Request zu prüfen)

### Ausprobieren

1. Das Hauptverzeichnis des Repositorys in VS Code öffnen.
2. In `extension/` den Befehl `npm install` ausführen.
3. F5 drücken, um einen Extension Development Host zu starten.
4. In der Befehlspalette **DotNet Solution Atlas: Open sample map** ausführen.
   Das Beispiel funktioniert ohne .NET SDK.

Um eine echte Solution zu analysieren, baust du den Analyzer einmal
(`npm run build:analyzer` in `extension/`), öffnest einen Ordner mit einer
`.sln`, `.slnx`, `.csproj` oder `.vbproj` und führst **DotNet Solution Atlas:
Open map of the solution** aus.

Der Analyzer lässt sich auch allein benutzen:

```
dotnet run --project analyzer/Atlas.Analyzer -- pfad/zu/Deine.sln --out graph.json
```

### Die Karte benutzen

Die Oberfläche der Erweiterung ist englisch.

- Pfeile zeigen von einem Typ auf die Typen, von denen er abhängt.
- Die Farbe zeigt die Art des Typs. Beziehungen:
  - durchgezogene Linie mit gefülltem Pfeilkopf: Vererbung
  - gestrichelte Linie: Implementierung eines Interfaces
  - dünne graue Linie: ein Typ wird verwendet (Signaturen, `new`, Casts,
    `typeof`, Attribute, generische Argumente und Einschränkungen, abgeleitete
    `var`-Typen)
  - orange gepunktete Linie: eine Methode, ein Konstruktor, ein Operator oder
    ein Delegate wird aufgerufen, auch statische Helfer und Erweiterungsmethoden
  - lila gepunktete Linie: auf eine Property, einen Indexer oder ein Feld wird
    zugegriffen
  - grün gestrichelte Linie: ein Typ wird beim Dependency-Injection-Container
    registriert (`services.AddScoped<IOrders, Orders>()`, `AddHostedService<T>()`,
    ...); der Pfeil zeigt auf den Dienst und auf die Implementierung
  - rot gepunktete Linie: ein Event wird abonniert, abbestellt oder ausgelöst
  - gelb gestrichelte Linie: ein Typ ist mit einer Attributklasse der Solution
    markiert
  - blaue gestrichelte Linie: ein Typ wird in einer XAML-Datei genannt (Element, `{x:Type}`, `{x:Static}`, geladene XAML-Datei); der Pfeil beginnt am Typ dieser Datei
- Jede Beziehungsart lässt sich im Filter „Relationships“ ein- und
  ausschalten. Standardmäßig sind alle sichtbar; schalte einige aus, wenn die
  Karte zu voll wird.
- „Groups“ listet die zusammenhängenden Gruppen der sichtbaren Typen und die
  Typen ohne jede Beziehung. Ein Klick auf eine Gruppe zoomt zu ihr und listet
  ihre Mitglieder. Zusammen mit den Filtern zeigt das, welche Teile des Codes
  vom Rest abgeschnitten sind, zum Beispiel nach dem Ausblenden eines
  Logging-Interfaces.
- Ein Klick auf einen Typ zeigt seine Nachbarn, ein Doppelklick öffnet ihn im
  Editor.
- Nach Typart, Projekt und Sprache filtern, nach Namen suchen oder „Focus on
  selection“ einschalten, um nur einen Typ und seine direkten Nachbarn zu sehen.
- Namespaces lassen sich in der Liste „Namespaces“ der Seitenleiste einzeln
  ausschalten; das Feld über der Liste grenzt sie ein. Jede Filterliste hat in
  der Überschrift „all“ und „none“; bei eingegrenzter Namespace-Liste gelten sie
  für die Namespaces, die aufgelistet sind.
- „Focus in map“ in den Details rechts zentriert die Karte auf den gewählten Typ
  und seine Nachbarn, zum Beispiel nachdem du ihn in einer Liste links gewählt hast.
- „Export…“ speichert die Karte so, wie sie angezeigt wird (mit Filtern,
  zusammengefassten Gruppen und Namespace-Rahmen), als PNG, SVG, Mermaid,
  Graphviz DOT oder JSON.
- „Compare with Git…“ fragt nach einem Branch, Tag oder Commit und analysiert
  diesen Stand in einem temporären Checkout (dein Arbeitsverzeichnis bleibt
  unberührt, die Pakete werden dort wiederhergestellt). Neue Typen und
  Abhängigkeiten erhalten einen grünen Rand bzw. eine grüne Linie, entfernte
  werden als rote gestrichelte Geister erneut gezeichnet, und die Seitenleiste
  listet die Änderungen. „Clear comparison“ entfernt die Markierungen.
  Voraussetzung sind ein Git-Repository und Zugriff auf die Paketquellen.

### Architekturregeln

Architekturregeln beschreiben, wie die Solution aufgebaut sein *soll*; die
Karte zeigt dann, wo der Code davon abweicht. Ein typisches Beispiel: Die
Domain-Schicht darf die Datenbank-Schicht nicht kennen. Nichts hindert ein
`using Shop.Infrastructure` daran, sich in eine Domain-Klasse einzuschleichen,
aber mit einer Regel wird diese Abhängigkeit rot gezeichnet und aufgelistet.

**Erste Schritte**

1. Drücke in der Seitenleiste der Karte unter „Architecture rules“ auf „Create
   rules file“. Das legt `.atlas.json` neben der Solution an, mit dem
   häufigsten Namespace-Präfix deines Codes als Ausgangspunkt.
2. Passe die Schichten an deine Namespaces oder Projekte an und füge Regeln hinzu.
3. Drücke in der Karte auf „Reload“. Die Prüfung läuft sofort, eine neue
   Analyse ist nicht nötig.

Die Datei wird zuerst neben der Solution gesucht, dann in den
Workspace-Ordnern. Der Dateiname lässt sich mit der Einstellung
`dotnetAtlas.rulesFile` ändern. Die Beispielkarte („Open sample map“) bringt
eigene Regeln mit, sodass du einen Verstoß ohne jede Einrichtung siehst.

**Die Datei**

```json
{
  "layers": [
    { "name": "Domain",         "namespaces": ["Shop.Domain", "Shop.Domain.*"] },
    { "name": "Application",    "namespaces": ["Shop.Application", "Shop.Application.*"] },
    { "name": "Infrastructure", "projects": ["Shop.Infrastructure"] },
    { "name": "Web",            "projects": ["Shop.Web"] }
  ],
  "rules": [
    { "from": "Domain",         "canOnlyUse": [] },
    { "from": "Application",    "canOnlyUse": ["Domain"] },
    { "from": "Infrastructure", "cannotUse": ["Web"] }
  ]
}
```

*Schichten* (`layers`) gruppieren die Typen der Solution:

- `name` ist der Name, mit dem Regeln auf die Schicht verweisen.
- `namespaces` und `projects` sind Listen von Mustern. Ein Typ gehört zur
  Schicht, wenn sein Namespace oder der Name seines Projekts (ohne `.csproj`)
  zu einem davon passt. Du kannst eine der Listen verwenden oder beide.
- In einem Muster steht `*` für beliebige Zeichen, Punkte eingeschlossen; alles
  andere ist wörtlich gemeint und unterscheidet Groß- und Kleinschreibung, und
  das Muster muss auf den ganzen Namen passen. `Shop.Domain*` passt daher auch
  auf `Shop.DomainTools`. Für den Namespace und alles darunter, aber sonst
  nichts, schreibst du `Shop.Domain` und `Shop.Domain.*`.
- Passen mehrere Schichten, gilt die erste in der Datei. Stelle die speziellen
  Schichten vor die allgemeinen.

*Regeln* (`rules`) begrenzen, was eine Schicht verwenden darf:

- `from` ist die Schicht, um die es in der Regel geht.
- `cannotUse` nennt Schichten, die nicht verwendet werden dürfen.
- `canOnlyUse` nennt die einzigen Schichten, die verwendet werden dürfen. Eine
  leere Liste bedeutet „keine“: Die Schicht darf von keiner anderen Schicht
  abhängen.
- Eine Schicht kann mehrere Regeln haben, und eine Regel kann beide Listen
  enthalten.
- Eine Regel beschränkt die Abhängigkeiten, die eine Schicht *verlassen*. Um
  „nur Application darf Infrastructure verwenden“ auszudrücken, schreibst du
  Regeln für die anderen Schichten (`cannotUse` oder `canOnlyUse`), nicht für
  Infrastructure.

**Was als Verstoß zählt**

- Eine Beziehung von einem Typ der Schicht A zu einem Typ der Schicht B, die
  eine Regel von A verbietet. Jede Art von Beziehung zählt: Vererbung,
  Verwendung eines Typs, Aufrufe, Zugriffe, Registrierungen, Events und
  Attribute.
- Immer erlaubt sind Abhängigkeiten innerhalb einer Schicht, Abhängigkeiten von
  und zu Typen ohne Schicht sowie Schichten ohne Regel.
- Die Prüfung arbeitet mit dem, was die Filter durchlassen. Blendest du „Uses
  types“ oder ein Projekt aus, verschwinden auch die Verstöße, die aus diesen
  Beziehungen oder Typen bestehen. Schalte für eine vollständige Prüfung alle
  Beziehungen ein.
- Das Zusammenfassen von Namespaces oder Projekten ändert nur die Darstellung;
  die Regeln werden an den Typen geprüft.

**In der Karte**

- Verletzende Beziehungen werden dick und rot gezeichnet. „Mark rule
  violations“ unter „Analysis“ schaltet die Markierung aus.
- „Architecture rules“ in der Seitenleiste zeigt, wie viele Schichten es gibt,
  wie viele Typen einer Schicht zugeordnet wurden (eine niedrige Zahl
  bedeutet meist, dass die Muster nicht zu deinen Namespaces passen) und jeden
  Verstoß mit der Regel, die er verletzt. Ein Klick auf einen Eintrag zeigt ihn
  in der Karte.
- Fehler in der Datei (ein unbekannter Schichtname, eine Schicht ohne Muster,
  eine Regel ohne `cannotUse` und `canOnlyUse`) werden dort aufgelistet; der
  Rest der Datei gilt weiter.

**Tipps**

- Beginne mit der einen oder den zwei wichtigsten Regeln, zum Beispiel „Domain
  darf nur Domain verwenden“, und ergänze weitere, wenn diese sauber sind.
- Die Stelle, an der die Anwendung zusammengesetzt wird (`Program.cs`, eine
  Startup-Klasse), kennt berechtigterweise alle Schichten, und Registrierungen
  im Dependency-Injection-Container zählen als Beziehungen. Gib diesem Code
  eine Schicht ohne Regeln oder lass ihn weg.
- Bestehende Verstöße sind kein Grund, auf eine Regel zu verzichten: Die Zahl in
  der Seitenleiste zeigt, ob sie mit der Zeit sinkt. Zusammen mit „Compare with
  Git…“ siehst du außerdem, welche Verstöße ein Branch neu einführt.

### Die Karte aktuell halten

Die Karte ist eine Momentaufnahme. Solange sie offen ist, beobachtet die
Erweiterung die Quelldateien der Solution (`.cs`, `.vb`, Projektdateien,
`.xaml`, `.axaml`; nicht `bin`, `obj` oder `node_modules`). Nach einer Änderung
erscheint über der Werkzeugleiste ein Hinweis mit der Zahl der geänderten
Dateien. „Reload map“ analysiert die Solution erneut (auch als Befehl „Analyze
the solution of the open map again“), „Dismiss“ blendet den Hinweis aus. Nach
dem Neuladen gelten wieder die Standardfilter, und ein Vergleich mit Git wird
zurückgesetzt.

### Ungenutzte Typen

„Unused candidates“ in der Seitenleiste listet Typen auf, auf die im
analysierten Code nichts verweist. Das sind nur Kandidaten: Ein Typ, den ein
Framework selbst erzeugt, hat keinen Verweis im Code und sieht ungenutzt aus.
Typische Fälle sind WPF-Fenster und -Steuerelemente, die nur in XAML eingebunden
werden, Controller, Hosted Services, Testklassen und Typen, die per Reflection
oder Dependency Injection erzeugt werden.

Deshalb werden standardmäßig ausgelassen, und die Liste nennt, wie viele Typen
ausgeblendet wurden und warum:

- Typen, die von Klassen aus WPF, Avalonia, WinUI, MAUI oder Xamarin.Forms,
  von ASP.NET-Core-Controllern, Razor Pages, Blazor-Komponenten, SignalR-Hubs,
  Hosted Services und Windows-Diensten abgeleitet sind
- Typen mit Test- oder MEF-Attributen (xUnit, NUnit, MSTest, `System.ComponentModel.Composition`)
- Typen mit einer `Main`-Methode

Eigene Ausnahmen trägst du unter `ignoreUnused` in der Regeldatei ein (die
Muster funktionieren wie die Schichtmuster, `*` steht für beliebige Zeichen).
Die Datei darf auch nur diesen Teil enthalten. `types` passen auf den
vollständigen Namen, `baseTypes` auf Basisklassen und Interfaces (auch die des
Frameworks, als vollständige Namen ohne Typargumente), `attributes` auf die
Attributklassen am Typ und seinen Mitgliedern.

```json
{
  "ignoreUnused": {
    "namespaces": ["Shop.Generated*"],
    "types": ["Shop.Api.Startup"],
    "baseTypes": ["Shop.Plugins.IPlugin"],
    "attributes": ["Shop.Serialization.*"]
  }
}
```

Das Kontrollkästchen „Apply exceptions“ schaltet alle Ausnahmen ab.

**XAML.** Der Analyzer liest auch die `.xaml`- und `.axaml`-Dateien der
Projekte. Ein Typ, den eine XAML-Datei nennt (als Element wie
`<local:OrderView/>`, in `{x:Type}`, `{x:Static}`, einer Markup-Erweiterung,
einer Attached Property oder als Ziel eines Styles oder Templates), wird vom Typ
dieser Datei (`x:Class`) über die Beziehung „XAML references“ referenziert. Ein
über `StartupUri` gestartetes Fenster und eingebundene Resource Dictionaries
zählen ebenfalls; Resource Dictionaries werden der `Application`-Klasse
zugerechnet. Nicht erkannt werden Verweise, die erst zur Laufzeit entstehen: ein
Fenster, das über eine Zeichenfolge geöffnet wird, Bindings über Eigenschaftsnamen,
ein `DataContext`, der im Code gesetzt wird. Mit `dotnetAtlas.analyzeXaml` auf
`false` werden die XAML-Dateien übersprungen.

**Globale Ausnahmen.** Die Einstellung `dotnetAtlas.ignoreUnused` hat dieselben
Schlüssel wie die Regeldatei und gilt für alle Solutions. Mit
`dotnetAtlas.ignoreUnusedDefaults` auf `false` entfallen die eingebauten
Ausnahmen. Eingebaute Ausnahmen, Einstellung und Regeldatei werden zusammen
angewendet.

### Unterstützte Sprachen

C# und Visual Basic, bei Bedarf in derselben Solution. F# wird nicht
unterstützt, weil Roslyn es nicht analysiert. Ein Visual-Basic-Modul wird als
statische Klasse dargestellt; der vom Compiler erzeugte Namespace `My` wird
ausgelassen.

In einer Solution, die beides mischt, werden Beziehungen zwischen den Sprachen
wie alle anderen dargestellt, und es erscheint ein Filter „Languages“, mit dem
sich der C#- und der Visual-Basic-Teil getrennt betrachten lassen.

### Einstellungen

| Einstellung                | Standard | Bedeutung                                                                        |
| -------------------------- | -------- | -------------------------------------------------------------------------------- |
| `dotnetAtlas.dotnetPath`   | `dotnet` | Pfad oder Name der dotnet-Programmdatei, mit der der Analyzer gestartet wird     |
| `dotnetAtlas.analyzerPath` | leer     | Pfad zu `Atlas.Analyzer.dll`; leer verwendet den mitgelieferten Analyzer         |
| `dotnetAtlas.zoomSpeed`    | `1`      | Geschwindigkeit beim Zoomen mit dem Mausrad (0,1 bis 10), gilt für die nächste Karte |
| `dotnetAtlas.namespaceGrouping` | `off` | Namespace-Rahmen beim Öffnen der Karte: `off`, `grouped` oder `nested` (in der Werkzeugleiste änderbar) |
| `dotnetAtlas.rulesFile` | `.atlas.json` | Name der Datei mit den Architekturregeln, gesucht neben der Solution und in den Workspace-Ordnern |

### Voraussetzungen

- Visual Studio Code 1.85 oder neuer
- .NET SDK 8.0 oder neuer (der Analyzer braucht es, um deine Solution zu laden)
- Node.js 20 oder neuer (nur zum Bauen der Erweiterung)

### Aufbau des Repositorys

| Pfad         | Inhalt                                       |
| ------------ | -------------------------------------------- |
| `analyzer/`  | .NET-Konsolenprogramm (Roslyn) und seine Tests |
| `extension/` | VS-Code-Erweiterung (TypeScript, Webview)    |

### Lizenz

MIT, siehe [LICENSE](LICENSE). Frei nutzbar, veränderbar und weitergebbar. Auch die verwendeten Komponenten von Dritten (Cytoscape.js, dagre, cytoscape-dagre, Roslyn, MSBuild Locator) stehen unter der MIT-Lizenz.

[Zurück nach oben](#dotnet-solution-atlas)

---

<a id="中文"></a>

## 中文

这是一个 Visual Studio Code 扩展，可以把 .NET 解决方案（solution）绘制成一张地图。
它使用 Roslyn 分析当前打开的解决方案（支持 C# 和 Visual Basic，也可混合），
将类、接口、结构体、记录、枚举和委托显示为节点，将它们之间的关系（继承、实现、使用）
显示为连线。目标是让你一眼就能回答这样的问题：“哪些类型依赖这个类型？”
“这份代码的枢纽在哪里？”“这个解决方案是如何分层的？”

> 状态：早期开发（0.1 版）。仍有不完善之处。Visual Basic 支持是新增的，测试较少。

### 工作原理

```
 .sln / .csproj / .vbproj
       |
       v
 analyzer/   基于 Roslyn 的命令行工具，将依赖关系图输出为 JSON
       |
       v
 extension/  VS Code 扩展：运行分析器，在 Webview 中显示关系图
```

- `analyzer/` 使用 `MSBuildWorkspace` 加载解决方案，遍历源代码中声明的所有类型，
  并将节点和边输出为 JSON。
- `extension/` 启动分析器，接收 JSON，并用 Cytoscape.js 渲染。点击节点会打开声明该类型的文件。

### 功能

- 类型：类、接口、结构体、记录、枚举、委托，以及顶级语句（没有类的 `Program.cs`）
  会作为单独的节点显示
- 关系：继承、实现、类型使用、方法调用、属性/字段访问、依赖注入注册、事件和特性，每一种都可以单独开关
- 分层布局，方便区分接口和实现
- 按关系、类型种类、项目、语言和命名空间过滤（每个列表都有“all / none”）；按名称搜索
- 聚焦模式：只显示选中的类型及其相邻类型
- 按命名空间分组：在每个命名空间的类型周围绘制虚线框，可嵌套显示（Off、Grouped、Nested）
- 将命名空间或项目分别折叠为一个节点，便于纵览大型解决方案
- 分析：类型、命名空间和项目之间的依赖循环（以红色标出）、枢纽排名（耦合度、
  扇入、扇出、不稳定度、规模）、可能未使用的类型，以及按耦合度、使用量或规模
  调整节点高度
- 架构规则：在 `.atlas.json` 中定义各层及其可使用的内容；违规的关系以红色绘制
  并列出
- 成员：类型的详情列出其成员，以及每个成员调用、访问或使用了什么
- 详情面板显示统计信息，并可跳转到源文件
- 分组：显示相互连通的类型组，以及没有任何关系的类型，用于找出与其余代码隔离的部分
- 导出当前显示的地图：PNG、SVG、Mermaid、Graphviz DOT 或 JSON
- 与 Git 提交、分支或标签比较：新增的类型和依赖以绿色标出，已删除的以红色虚线“幽灵”显示，
  并列出所有变更（便于审查拉取请求）

### 试用

1. 在 VS Code 中打开仓库根目录。
2. 在 `extension/` 中运行 `npm install`。
3. 按 F5 启动扩展开发宿主（Extension Development Host）。
4. 在命令面板中运行 **DotNet Solution Atlas: Open sample map**。
   示例无需 .NET SDK 即可使用。

要分析真实的解决方案，请先构建一次分析器（在 `extension/` 中运行
`npm run build:analyzer`），打开包含 `.sln`、`.slnx`、`.csproj` 或 `.vbproj`
的文件夹，然后运行 **DotNet Solution Atlas: Open map of the solution**。

分析器也可以单独使用：

```
dotnet run --project analyzer/Atlas.Analyzer -- path/to/Your.sln --out graph.json
```

### 使用地图

扩展的界面为英文。

- 箭头从一个类型指向它所依赖的类型。
- 颜色表示类型的种类。关系的表示方式：
  - 带实心箭头的实线：继承
  - 虚线：接口实现
  - 细灰线：使用了某个类型（签名、`new`、类型转换、`typeof`、特性、泛型参数和约束、推断出的 `var` 类型）
  - 橙色点线：调用了方法、构造函数、运算符或委托，包括静态辅助类和扩展方法
  - 紫色点线：访问了属性、索引器或字段
  - 绿色虚线：类型被注册到依赖注入容器（`services.AddScoped<IOrders, Orders>()`、`AddHostedService<T>()` 等），箭头指向服务和实现
  - 红色点线：订阅、取消订阅或触发了事件
  - 黄色虚线：类型被解决方案中的特性类标注
  - 蓝色虚线：XAML 文件中提到某个类型（元素、`{x:Type}`、`{x:Static}`、加载的 XAML 文件）；箭头从该文件的类型出发
- 每一种关系都可以在“Relationships”过滤器中单独开关。默认全部显示；
  如果地图过于拥挤，可以关闭其中一些。
- “Groups”列出可见类型中相互连通的组，以及没有任何关系的类型。点击某个组会缩放到该组，
  并列出其成员。结合过滤器，可以看出哪些代码与其余部分隔离，例如隐藏日志接口之后。
- 点击类型可查看其相邻类型，双击可在编辑器中打开。
- 可按类型种类、项目和语言过滤，按名称搜索，或开启“Focus on selection”，
  只查看某个类型及其直接相邻的类型。
- 可以在侧边栏的“Namespaces”列表中逐个关闭命名空间；列表上方的输入框可缩小列表范围。
  每个过滤列表的标题中都有“all”和“none”；命名空间列表被缩小时，它们只作用于列出的命名空间。
- 右侧详情中的“Focus in map”会将地图居中到所选类型及其相邻类型，例如在左侧列表中选中它之后。
- “Export…”按当前显示的样子（包含过滤结果、折叠的分组和命名空间框）将地图保存为
  PNG、SVG、Mermaid、Graphviz DOT 或 JSON。
- “Compare with Git…”会询问分支、标签或提交，并在临时检出目录中分析该版本
  （不会改动你的工作目录，包会在临时目录中还原）。新增的类型和依赖以绿色边框或绿线标出，
  已删除的以红色虚线“幽灵”重新绘制，侧边栏列出所有变更。“Clear comparison”清除标记。
  需要 Git 仓库并能访问包源。

### 架构规则

架构规则描述解决方案“应该”如何构建；地图则显示代码在哪些地方偏离了这一设计。典型例子：
领域层不应该知道数据库层。没有什么能阻止 `using Shop.Infrastructure` 悄悄混进某个领域类，
但有了规则，这个依赖就会以红色绘制并列出。

**快速开始**

1. 在地图侧边栏的“Architecture rules”下点击“Create rules file”。这会在解决方案旁创建
   `.atlas.json`，并以代码中最常见的命名空间前缀作为起点。
2. 按你的命名空间或项目调整各层，并添加规则。
3. 在地图中点击“Reload”。检查会立即运行，无需重新分析。

文件先在解决方案旁查找，然后在工作区文件夹中查找。文件名可通过设置
`dotnetAtlas.rulesFile` 修改。示例地图（“Open sample map”）自带规则，
无需任何配置就能看到违规。

**文件格式**

```json
{
  "layers": [
    { "name": "Domain",         "namespaces": ["Shop.Domain", "Shop.Domain.*"] },
    { "name": "Application",    "namespaces": ["Shop.Application", "Shop.Application.*"] },
    { "name": "Infrastructure", "projects": ["Shop.Infrastructure"] },
    { "name": "Web",            "projects": ["Shop.Web"] }
  ],
  "rules": [
    { "from": "Domain",         "canOnlyUse": [] },
    { "from": "Application",    "canOnlyUse": ["Domain"] },
    { "from": "Infrastructure", "cannotUse": ["Web"] }
  ]
}
```

*层*（`layers`）用于把解决方案中的类型分组：

- `name` 是规则引用该层时使用的名称。
- `namespaces` 和 `projects` 是模式列表。如果类型的命名空间或其项目名称（不含 `.csproj`）
  匹配其中之一，它就属于该层。可以只用其中一个列表，也可以两个都用。
- 模式中的 `*` 代表任意字符（包括点）；其余部分按字面匹配并区分大小写，
  且模式必须匹配整个名称。因此 `Shop.Domain*` 也会匹配 `Shop.DomainTools`。
  若要只匹配该命名空间及其下级，请同时写 `Shop.Domain` 和 `Shop.Domain.*`。
- 如果多个层都匹配，以文件中靠前的为准。请把具体的层放在笼统的层之前。

*规则*（`rules`）限制某一层可以使用什么：

- `from` 是规则所针对的层。
- `cannotUse` 列出不得使用的层。
- `canOnlyUse` 列出唯一可以使用的层。空列表表示“一个也没有”：该层不得依赖任何其他层。
- 一个层可以有多条规则，一条规则也可以同时包含两个列表。
- 规则限制的是*离开*某一层的依赖。要表达“只有 Application 可以使用 Infrastructure”，
  请为其他层编写规则（`cannotUse` 或 `canOnlyUse`），而不是为 Infrastructure 编写。

**什么算违规**

- 从 A 层的类型指向 B 层的类型、且被 A 的某条规则禁止的关系。所有种类的关系都计入：
  继承、类型使用、调用、访问、注册、事件和特性。
- 始终允许的有：同一层内部的依赖、来自或指向不属于任何层的类型的依赖，以及没有规则的层。
- 检查基于过滤器放行的内容。如果隐藏了“Uses types”或某个项目，由这些关系或类型构成的违规
  也会随之消失。要进行完整检查，请打开所有关系。
- 折叠命名空间或项目只改变显示；规则是在类型上检查的。

**在地图中**

- 违规的关系以粗红线绘制。“Analysis”下的“Mark rule violations”可关闭该标记。
- 侧边栏的“Architecture rules”显示有多少个层、多少个类型被分配到某个层
  （数字很低通常说明模式与你的命名空间不匹配），以及每个违规和它违反的规则。
  点击条目即可在地图中定位。
- 文件中的错误（未知的层名、没有模式的层、既没有 `cannotUse` 也没有 `canOnlyUse` 的规则）
  会在那里列出；文件的其余部分仍然有效。

**提示**

- 先从最重要的一两条规则开始，例如“Domain 只能使用 Domain”，等它们干净之后再添加更多。
- 组装应用程序的地方（`Program.cs`、启动类）理所当然地了解所有层，而且向依赖注入容器的注册
  也算作关系。请为这部分代码设置一个没有规则的层，或者不把它纳入任何层。
- 已有的违规不是放弃规则的理由：侧边栏中的数字会显示它是否随时间下降。
  结合“Compare with Git…”，还可以看出某个分支新引入了哪些违规。

### 保持地图为最新

地图是一个快照。地图打开期间，扩展会监视解决方案的源文件（`.cs`、`.vb`、项目文件、
`.xaml`、`.axaml`；不含 `bin`、`obj`、`node_modules`）。发生更改后，工具栏上方会出现提示条，
显示已更改的文件数量。“Reload map”会重新分析解决方案（也可通过命令
“Analyze the solution of the open map again”），“Dismiss”隐藏提示条。重新加载后恢复默认过滤器，
并清除与 Git 的比较。

### 未使用的类型

侧边栏的“Unused candidates”列出在已分析的代码中没有任何引用的类型。它们只是候选：
由框架自行创建的类型在代码中没有引用，看起来像是未使用。典型情况包括只在 XAML 中
接入的 WPF 窗口和控件、控制器、托管服务、测试类，以及通过反射或依赖注入创建的类型。

因此默认会排除以下内容，列表会说明有多少类型被隐藏以及原因：

- 派生自 WPF、Avalonia、WinUI、MAUI 或 Xamarin.Forms 的类、ASP.NET Core 控制器、
  Razor Pages、Blazor 组件、SignalR Hub、托管服务和 Windows 服务的类型
- 带有测试或 MEF 特性的类型（xUnit、NUnit、MSTest、`System.ComponentModel.Composition`）
- 含有 `Main` 方法的类型

自定义例外写在规则文件的 `ignoreUnused` 下（模式与层模式相同，`*` 匹配任意字符）。
文件可以只包含这一部分。`types` 匹配完整名称，`baseTypes` 匹配基类和接口
（也包括框架的，使用不带类型参数的完整名称），`attributes` 匹配类型及其成员上的特性类。

```json
{
  "ignoreUnused": {
    "namespaces": ["Shop.Generated*"],
    "types": ["Shop.Api.Startup"],
    "baseTypes": ["Shop.Plugins.IPlugin"],
    "attributes": ["Shop.Serialization.*"]
  }
}
```

复选框“Apply exceptions”可关闭所有例外。

**XAML。** 分析器也会读取项目中的 `.xaml` 和 `.axaml` 文件。XAML 文件中提到的类型
（作为 `<local:OrderView/>` 之类的元素、在 `{x:Type}`、`{x:Static}`、标记扩展、
附加属性中，或作为样式、模板的目标）会通过“XAML references”关系被该文件的类型
（`x:Class`）引用。通过 `StartupUri` 启动的窗口和合并的资源字典同样计入；
资源字典归到 `Application` 类。无法识别只在运行时产生的引用：通过字符串打开的窗口、
按属性名称的绑定、在代码中设置的 `DataContext`。将 `dotnetAtlas.analyzeXaml`
设为 `false` 可跳过 XAML 文件。

**全局例外。** 设置项 `dotnetAtlas.ignoreUnused` 的键与规则文件相同，对所有解决方案生效。
将 `dotnetAtlas.ignoreUnusedDefaults` 设为 `false` 会去掉内置例外。内置例外、
设置项和规则文件会合并使用。

### 支持的语言

支持 C# 和 Visual Basic，必要时可在同一解决方案中混合使用。不支持 F#，因为 Roslyn 不分析 F#。
Visual Basic 的模块（Module）会显示为静态类；编译器生成的 `My` 命名空间会被忽略。

在混合两种语言的解决方案中，跨语言的关系与其他关系一样显示，并且会出现“Languages”过滤器，
方便分别查看 C# 和 Visual Basic 部分。

### 设置

| 设置项                     | 默认值   | 说明                                                       |
| -------------------------- | -------- | ---------------------------------------------------------- |
| `dotnetAtlas.dotnetPath`   | `dotnet` | 用于运行分析器的 dotnet 可执行文件的路径或名称             |
| `dotnetAtlas.analyzerPath` | 空       | `Atlas.Analyzer.dll` 的路径；为空时使用扩展自带的分析器    |
| `dotnetAtlas.zoomSpeed`    | `1`      | 鼠标滚轮缩放速度（0.1 到 10），在下次打开地图时生效        |
| `dotnetAtlas.namespaceGrouping` | `off` | 打开地图时的命名空间框：`off`、`grouped` 或 `nested`（可在工具栏中更改） |
| `dotnetAtlas.rulesFile` | `.atlas.json` | 架构规则文件的名称，在解决方案旁边和工作区文件夹中查找 |

### 环境要求

- Visual Studio Code 1.85 或更高版本
- .NET SDK 8.0 或更高版本（分析器需要它来加载你的解决方案）
- Node.js 20 或更高版本（仅用于构建扩展）

### 仓库结构

| 路径         | 内容                                  |
| ------------ | ------------------------------------- |
| `analyzer/`  | .NET 命令行工具（Roslyn）及其测试     |
| `extension/` | VS Code 扩展（TypeScript、Webview）   |

### 许可证

MIT，详见 [LICENSE](LICENSE)。可自由使用、修改和分发。所使用的第三方组件（Cytoscape.js, dagre, cytoscape-dagre, Roslyn, MSBuild Locator）同样采用 MIT 许可证。

[返回顶部](#dotnet-solution-atlas)

---

<a id="русский"></a>

## Русский

Расширение для Visual Studio Code, которое превращает решение (solution) .NET в
карту. Оно анализирует открытое решение (C# и Visual Basic, в том числе
смешанные) с помощью Roslyn и показывает классы, интерфейсы, структуры, записи,
перечисления и делегаты как узлы, а их связи (наследование, реализацию,
использование) — как соединения. Цель — с одного взгляда отвечать на вопросы
вроде «что зависит от этого типа?», «где узловые точки этой кодовой базы?» и
«как устроены слои этого решения?».

> Статус: ранняя разработка (версия 0.1). Возможны шероховатости. Поддержка
> Visual Basic появилась недавно и протестирована меньше.

### Как это работает

```
 .sln / .csproj / .vbproj
       |
       v
 analyzer/   консольная утилита на основе Roslyn, записывает граф зависимостей в JSON
       |
       v
 extension/  расширение VS Code: запускает анализатор, показывает граф в веб-представлении
```

- `analyzer/` загружает решение через `MSBuildWorkspace`, обходит все типы,
  объявленные в исходном коде, и выводит узлы и рёбра в формате JSON.
- `extension/` запускает анализатор, получает JSON и отображает его с помощью
  Cytoscape.js. Щелчок по узлу открывает файл, в котором объявлен тип.

### Возможности

- Типы: классы, интерфейсы, структуры, записи, перечисления, делегаты, а также
  операторы верхнего уровня (`Program.cs` без класса) как отдельный узел
- Связи: наследование, реализация, использование типов, вызовы методов, доступ
  к свойствам и полям, регистрации во внедрении зависимостей, события и
  атрибуты; каждый вид можно включать и отключать отдельно
- Многоуровневая раскладка, чтобы интерфейсы и реализации легко различались
- Фильтры по связям, виду типа, проекту, языку и пространству имён (у каждого
  списка есть «all / none»); поиск по имени
- Режим фокуса: только выбранный тип и его соседи
- Группировка по пространствам имён: пунктирные рамки вокруг типов каждого пространства, при желании вложенные (Off, Grouped, Nested)
- Свёртка пространств имён или проектов в один узел каждое, чтобы охватить
  взглядом большие решения
- Анализ: циклические зависимости между типами, пространствами имён и проектами
  (красным), рейтинг узловых точек (связанность, fan-in, fan-out,
  нестабильность, размер), кандидаты на неиспользуемые типы и высота узла по
  связанности, использованию или размеру
- Архитектурные правила: слои и то, что им разрешено использовать, задаются в
  `.atlas.json`; нарушения рисуются красным и перечисляются в списке
- Члены: в сведениях о типе перечислены его члены и то, что каждый из них
  вызывает, читает или использует
- Панель сведений с метриками и переход к исходному файлу
- Группы: связные группы типов и типы без каких-либо связей — для поиска частей
  кода, отрезанных от остального
- Экспорт карты в том виде, как она показана: PNG, SVG, Mermaid, Graphviz DOT или JSON
- Сравнение с коммитом, веткой или тегом Git: новые типы и зависимости —
  зелёным, удалённые — красными пунктирными «призраками», плюс список изменений
  (удобно для проверки pull request)

### Попробовать

1. Откройте корневую папку репозитория в VS Code.
2. В папке `extension/` выполните `npm install`.
3. Нажмите F5, чтобы запустить Extension Development Host.
4. В палитре команд выполните **DotNet Solution Atlas: Open sample map**.
   Пример работает без .NET SDK.

Чтобы проанализировать настоящее решение, один раз соберите анализатор
(`npm run build:analyzer` в папке `extension/`), откройте папку с файлом `.sln`,
`.slnx`, `.csproj` или `.vbproj` и выполните **DotNet Solution Atlas: Open map
of the solution**.

Анализатор можно использовать и отдельно:

```
dotnet run --project analyzer/Atlas.Analyzer -- path/to/Your.sln --out graph.json
```

### Работа с картой

Интерфейс расширения — на английском языке.

- Стрелки идут от типа к типам, от которых он зависит.
- Цвет показывает вид типа. Связи:
  - сплошная линия с закрашенным наконечником: наследование
  - пунктирная линия: реализация интерфейса
  - тонкая серая линия: тип используется (сигнатуры, `new`, приведения типов,
    `typeof`, атрибуты, аргументы и ограничения обобщений, выводимые типы `var`)
  - оранжевая точечная линия: вызывается метод, конструктор, оператор или
    делегат, включая статические вспомогательные классы и методы расширения
  - фиолетовая точечная линия: выполняется обращение к свойству, индексатору
    или полю
  - зелёная пунктирная линия: тип регистрируется в контейнере внедрения
    зависимостей (`services.AddScoped<IOrders, Orders>()`,
    `AddHostedService<T>()` и т. д.); стрелка указывает на службу и на реализацию
  - красная точечная линия: на событие подписываются, отписываются от него или
    его вызывают
  - жёлтая пунктирная линия: тип помечен классом атрибута из решения
  - синяя пунктирная линия: тип назван в файле XAML (элемент, `{x:Type}`, `{x:Static}`, загружаемый файл XAML); стрелка начинается у типа этого файла
- Каждый вид связи можно включать и отключать в фильтре «Relationships». По
  умолчанию показаны все; отключите часть, если карта становится слишком
  загруженной.
- «Groups» перечисляет связные группы видимых типов и типы без каких-либо
  связей. Щелчок по группе приближает карту к ней и показывает её участников.
  Вместе с фильтрами это помогает увидеть, какие части кода отрезаны от
  остального, например после скрытия интерфейса журналирования.
- Щелчок по типу показывает его соседей, двойной щелчок открывает его в
  редакторе.
- Можно фильтровать по виду типа, проекту и языку, искать по имени или
  включить «Focus on selection», чтобы видеть только один тип и его прямых
  соседей.
- Пространства имён можно отключать по одному в списке «Namespaces» боковой
  панели; поле над списком сужает его. В заголовке каждого списка фильтров есть
  «all» и «none»; при суженном списке пространств имён они действуют на
  перечисленные пространства.
- «Focus in map» в сведениях справа центрирует карту на выбранном типе и его
  соседях, например после выбора типа в списке слева.
- «Export…» сохраняет карту в том виде, как она показана (с фильтрами,
  свёрнутыми группами и рамками пространств имён) в PNG, SVG, Mermaid,
  Graphviz DOT или JSON.
- «Compare with Git…» запрашивает ветку, тег или коммит и анализирует это
  состояние во временной копии (рабочий каталог не затрагивается, пакеты
  восстанавливаются там же). Новые типы и зависимости получают зелёную рамку
  или линию, удалённые рисуются снова как красные пунктирные «призраки», а
  боковая панель перечисляет изменения. «Clear comparison» убирает отметки.
  Нужны репозиторий Git и доступ к источникам пакетов.

### Архитектурные правила

Архитектурные правила описывают, как решение *должно* быть устроено; карта
затем показывает, где код отступает от этого. Типичный пример: слой домена не
должен знать о слое базы данных. Ничто не мешает `using Shop.Infrastructure`
проникнуть в класс домена, но с правилом такая зависимость рисуется красным и
попадает в список.

**Начало работы**

1. Нажмите «Create rules file» в разделе «Architecture rules» боковой панели
   карты. Будет создан `.atlas.json` рядом с решением, за отправную точку
   берётся самый частый префикс пространства имён в вашем коде.
2. Приведите слои в соответствие с вашими пространствами имён или проектами и
   добавьте правила.
3. Нажмите «Reload» на карте. Проверка выполняется сразу, новый анализ не нужен.

Файл ищется сначала рядом с решением, затем в папках рабочей области. Имя файла
можно изменить параметром `dotnetAtlas.rulesFile`. У демонстрационной карты
(«Open sample map») есть собственные правила, так что нарушение видно без
какой-либо настройки.

**Файл**

```json
{
  "layers": [
    { "name": "Domain",         "namespaces": ["Shop.Domain", "Shop.Domain.*"] },
    { "name": "Application",    "namespaces": ["Shop.Application", "Shop.Application.*"] },
    { "name": "Infrastructure", "projects": ["Shop.Infrastructure"] },
    { "name": "Web",            "projects": ["Shop.Web"] }
  ],
  "rules": [
    { "from": "Domain",         "canOnlyUse": [] },
    { "from": "Application",    "canOnlyUse": ["Domain"] },
    { "from": "Infrastructure", "cannotUse": ["Web"] }
  ]
}
```

*Слои* (`layers`) группируют типы решения:

- `name` — имя, по которому правила ссылаются на слой.
- `namespaces` и `projects` — списки шаблонов. Тип принадлежит слою, если его
  пространство имён или имя его проекта (без `.csproj`) подходит под один из
  шаблонов. Можно использовать любой из списков или оба.
- В шаблоне `*` означает любые символы, включая точки; всё остальное
  понимается буквально, с учётом регистра, а шаблон должен подходить ко всему
  имени целиком. Поэтому `Shop.Domain*` подходит и к `Shop.DomainTools`. Чтобы
  охватить пространство имён и всё, что под ним, и ничего больше, пишите
  `Shop.Domain` и `Shop.Domain.*`.
- Если подходит несколько слоёв, действует первый в файле. Ставьте конкретные
  слои перед общими.

*Правила* (`rules`) ограничивают то, что слой может использовать:

- `from` — слой, к которому относится правило.
- `cannotUse` перечисляет слои, которые использовать нельзя.
- `canOnlyUse` перечисляет единственные слои, которые можно использовать.
  Пустой список означает «никаких»: слой не может зависеть ни от одного
  другого слоя.
- У слоя может быть несколько правил, а правило может содержать оба списка.
- Правило ограничивает зависимости, которые *выходят* из слоя. Чтобы
  выразить «только Application может использовать Infrastructure», пишите
  правила для остальных слоёв (`cannotUse` или `canOnlyUse`), а не для
  Infrastructure.

**Что считается нарушением**

- Связь от типа слоя A к типу слоя B, которую запрещает правило A. Учитывается
  любой вид связи: наследование, использование типа, вызовы, обращения,
  регистрации, события и атрибуты.
- Всегда разрешены зависимости внутри одного слоя, зависимости от типов и к
  типам, не входящим ни в один слой, и слои без правил.
- Проверка работает с тем, что пропускают фильтры. Если скрыть «Uses types»
  или проект, исчезнут и нарушения, состоящие из этих связей или типов. Для
  полной проверки включите все связи.
- Свёртка пространств имён или проектов меняет только отображение; правила
  проверяются по типам.

**На карте**

- Нарушающие связи рисуются толстой красной линией. «Mark rule violations» в
  разделе «Analysis» отключает отметку.
- «Architecture rules» в боковой панели показывает число слоёв, сколько типов
  отнесено к слою (малое число обычно означает, что шаблоны не подходят к вашим
  пространствам имён) и каждое нарушение с правилом, которое оно нарушает.
  Щелчок по записи показывает его на карте.
- Ошибки в файле (неизвестное имя слоя, слой без шаблонов, правило без
  `cannotUse` и `canOnlyUse`) перечисляются там же; остальная часть файла
  продолжает действовать.

**Советы**

- Начните с одного-двух самых важных правил, например «Domain может
  использовать только Domain», и добавляйте остальные, когда эти будут чистыми.
- Место, где приложение собирается воедино (`Program.cs`, класс запуска),
  по праву знает все слои, а регистрации в контейнере внедрения зависимостей
  считаются связями. Отнесите этот код к слою без правил или оставьте его вне
  слоёв.
- Уже существующие нарушения — не повод отказываться от правила: число в
  боковой панели показывает, уменьшается ли оно со временем. Вместе с «Compare
  with Git…» можно увидеть и то, какие нарушения вносит ветка.

### Актуальность карты

Карта — это снимок. Пока она открыта, расширение следит за исходными файлами решения
(`.cs`, `.vb`, файлы проектов, `.xaml`, `.axaml`; не `bin`, `obj` и `node_modules`).
После изменения над панелью инструментов появляется полоса с числом изменённых файлов.
«Reload map» анализирует решение заново (также командой «Analyze the solution of the
open map again»), «Dismiss» скрывает полосу. После перезагрузки действуют фильтры по
умолчанию, а сравнение с Git сбрасывается.

### Неиспользуемые типы

«Unused candidates» в боковой панели перечисляет типы, на которые в проанализированном
коде ничто не ссылается. Это только кандидаты: тип, который создаёт сам фреймворк,
не имеет ссылок в коде и выглядит неиспользуемым. Типичные случаи — окна и элементы
управления WPF, подключаемые только в XAML, контроллеры, размещённые службы,
тестовые классы и типы, создаваемые через рефлексию или внедрение зависимостей.

Поэтому по умолчанию исключаются перечисленные ниже типы, а список показывает,
сколько типов скрыто и почему:

- типы, производные от классов WPF, Avalonia, WinUI, MAUI или Xamarin.Forms,
  контроллеров ASP.NET Core, Razor Pages, компонентов Blazor, хабов SignalR,
  размещённых служб и служб Windows
- типы с атрибутами тестов или MEF (xUnit, NUnit, MSTest, `System.ComponentModel.Composition`)
- типы с методом `Main`

Собственные исключения добавляются в `ignoreUnused` в файле правил (шаблоны работают
как шаблоны слоёв, `*` заменяет любые символы). Файл может содержать только эту
часть. `types` сопоставляются с полным именем, `baseTypes` — с базовыми классами и
интерфейсами (в том числе фреймворка, полные имена без аргументов типов),
`attributes` — с классами атрибутов на типе и его членах.

```json
{
  "ignoreUnused": {
    "namespaces": ["Shop.Generated*"],
    "types": ["Shop.Api.Startup"],
    "baseTypes": ["Shop.Plugins.IPlugin"],
    "attributes": ["Shop.Serialization.*"]
  }
}
```

Флажок «Apply exceptions» отключает все исключения.

**XAML.** Анализатор читает также файлы `.xaml` и `.axaml` проектов. Тип, который
назван в файле XAML (как элемент вроде `<local:OrderView/>`, в `{x:Type}`,
`{x:Static}`, расширении разметки, присоединённом свойстве или как цель стиля либо
шаблона), считается использованным типом этого файла (`x:Class`) — через связь
«XAML references». Окно, запускаемое через `StartupUri`, и подключаемые словари
ресурсов тоже учитываются; словари ресурсов относятся к классу `Application`.
Не распознаются ссылки, возникающие только во время выполнения: окно, открываемое по
строке, привязки по имени свойства, `DataContext`, заданный в коде. Если
`dotnetAtlas.analyzeXaml` равно `false`, файлы XAML пропускаются.

**Глобальные исключения.** Параметр `dotnetAtlas.ignoreUnused` имеет те же ключи, что
и файл правил, и действует для всех решений. При `dotnetAtlas.ignoreUnusedDefaults`
равном `false` встроенные исключения отключаются. Встроенные исключения, параметр и
файл правил применяются вместе.

### Поддерживаемые языки

C# и Visual Basic, при необходимости — в одном решении. F# не поддерживается,
потому что Roslyn его не анализирует. Модуль Visual Basic отображается как
статический класс; пространство имён `My`, создаваемое компилятором,
пропускается.

В решении, где смешаны оба языка, связи между языками показываются как и все
остальные, а также появляется фильтр «Languages», позволяющий смотреть на часть
на C# и часть на Visual Basic по отдельности.

### Настройки

| Параметр                   | По умолчанию | Значение                                                                   |
| -------------------------- | ------------ | -------------------------------------------------------------------------- |
| `dotnetAtlas.dotnetPath`   | `dotnet`     | Путь или имя исполняемого файла dotnet, которым запускается анализатор     |
| `dotnetAtlas.analyzerPath` | пусто        | Путь к `Atlas.Analyzer.dll`; если пусто, используется анализатор из состава расширения |
| `dotnetAtlas.zoomSpeed`    | `1`          | Скорость масштабирования колесом мыши (от 0,1 до 10), действует при следующем открытии карты |
| `dotnetAtlas.namespaceGrouping` | `off` | Рамки пространств имён при открытии карты: `off`, `grouped` или `nested` (можно изменить на панели инструментов) |
| `dotnetAtlas.rulesFile` | `.atlas.json` | Имя файла с архитектурными правилами; ищется рядом с решением и в папках рабочей области |

### Требования

- Visual Studio Code 1.85 или новее
- .NET SDK 8.0 или новее (нужен анализатору для загрузки вашего решения)
- Node.js 20 или новее (только для сборки расширения)

### Структура репозитория

| Путь         | Содержимое                                       |
| ------------ | ------------------------------------------------ |
| `analyzer/`  | консольная утилита .NET (Roslyn) и её тесты      |
| `extension/` | расширение VS Code (TypeScript, веб-представление) |

### Лицензия

MIT, см. [LICENSE](LICENSE). Можно свободно использовать, изменять и распространять. Используемые сторонние компоненты (Cytoscape.js, dagre, cytoscape-dagre, Roslyn, MSBuild Locator) также распространяются по лицензии MIT.

[Наверх](#dotnet-solution-atlas)

---

<a id="español"></a>

## Español

Una extensión de Visual Studio Code que convierte una solución de .NET en un
mapa. Analiza la solución abierta (C# y Visual Basic, también mezcladas) con
Roslyn y muestra clases, interfaces, structs, records, enums y delegados como
nodos, y sus relaciones (herencia, implementación, uso) como conexiones. El
objetivo es responder de un vistazo a preguntas como «¿qué depende de este
tipo?», «¿dónde están los puntos clave de este código?» y «¿cómo está
organizada en capas esta solución?».

> Estado: desarrollo temprano (versión 0.1). Quedan asperezas. La
> compatibilidad con Visual Basic es nueva y está menos probada.

### Cómo funciona

```
 .sln / .csproj / .vbproj
       |
       v
 analyzer/   herramienta de consola basada en Roslyn, escribe el grafo de dependencias como JSON
       |
       v
 extension/  extensión de VS Code: ejecuta el analizador y muestra el grafo en una webview
```

- `analyzer/` carga la solución con `MSBuildWorkspace`, recorre todos los tipos
  declarados en el código fuente y emite nodos y aristas como JSON.
- `extension/` inicia el analizador, recibe el JSON y lo dibuja con
  Cytoscape.js. Al hacer clic en un nodo se abre el archivo donde se declara.

### Funciones

- Tipos: clases, interfaces, structs, records, enums, delegados y las
  instrucciones de nivel superior (`Program.cs` sin clase) como un nodo propio
- Relaciones: herencia, implementación, uso de tipos, llamadas a métodos,
  acceso a propiedades y campos, registros de inyección de dependencias,
  eventos y atributos; cada una se puede activar y desactivar por separado
- Diseño por capas, para distinguir fácilmente interfaces e implementaciones
- Filtros por relación, tipo, proyecto, lenguaje y espacio de nombres (cada
  lista tiene «all / none»); búsqueda por nombre
- Modo de enfoque: solo el tipo seleccionado y sus vecinos
- Agrupar por espacio de nombres: marcos discontinuos alrededor de los tipos de cada espacio, también anidados (Off, Grouped, Nested)
- Contraer espacios de nombres o proyectos en un nodo cada uno, para tener una
  visión general de soluciones grandes
- Análisis: ciclos de dependencia entre tipos, espacios de nombres y proyectos
  (en rojo), ranking de puntos clave (acoplamiento, fan-in, fan-out,
  inestabilidad, tamaño), candidatos a tipos sin uso y altura del nodo según
  acoplamiento, uso o tamaño
- Reglas de arquitectura: capas y lo que pueden usar, definidas en
  `.atlas.json`; las infracciones se dibujan en rojo y se enumeran
- Miembros: los detalles de un tipo enumeran sus miembros y lo que cada uno
  llama, usa o a lo que accede
- Panel de detalles con métricas y salto al archivo de origen
- Grupos: grupos conectados de tipos y tipos sin ninguna relación, para
  encontrar partes del código aisladas del resto
- Exportación del mapa tal como se muestra: PNG, SVG, Mermaid, Graphviz DOT o JSON
- Comparación con un commit, una rama o una etiqueta de Git: los tipos y
  dependencias nuevos en verde, los eliminados como «fantasmas» rojos
  discontinuos, y una lista de los cambios (útil para revisar un pull request)

### Probarlo

1. Abre la raíz del repositorio en VS Code.
2. En `extension/`, ejecuta `npm install`.
3. Pulsa F5 para iniciar un Extension Development Host.
4. En la paleta de comandos, ejecuta **DotNet Solution Atlas: Open sample
   map**. El ejemplo funciona sin el SDK de .NET.

Para analizar una solución real, compila el analizador una vez
(`npm run build:analyzer` en `extension/`), abre una carpeta que contenga un
archivo `.sln`, `.slnx`, `.csproj` o `.vbproj` y ejecuta **DotNet Solution
Atlas: Open map of the solution**.

El analizador también se puede usar por sí solo:

```
dotnet run --project analyzer/Atlas.Analyzer -- path/to/Your.sln --out graph.json
```

### Usar el mapa

La interfaz de la extensión está en inglés.

- Las flechas van de un tipo a los tipos de los que depende.
- El color indica el tipo de elemento. Relaciones:
  - línea continua con punta rellena: herencia
  - línea discontinua: implementación de una interfaz
  - línea gris fina: se usa un tipo (firmas, `new`, conversiones, `typeof`,
    atributos, argumentos y restricciones genéricas, tipos inferidos con `var`)
  - línea naranja de puntos: se llama a un método, constructor, operador o
    delegado, incluidos los ayudantes estáticos y los métodos de extensión
  - línea morada de puntos: se accede a una propiedad, indizador o campo
  - línea verde discontinua: un tipo se registra en el contenedor de inyección
    de dependencias (`services.AddScoped<IOrders, Orders>()`,
    `AddHostedService<T>()`, ...); la flecha apunta al servicio y a la
    implementación
  - línea roja de puntos: se suscribe, se anula la suscripción o se dispara un evento
  - línea amarilla discontinua: un tipo está marcado con una clase de atributo de la solución
  - línea azul discontinua: un tipo se nombra en un archivo XAML (elemento, `{x:Type}`, `{x:Static}`, archivo XAML cargado); la flecha parte del tipo de ese archivo
- Cada tipo de relación se puede activar y desactivar en el filtro
  «Relationships». Por defecto se muestran todas; desactiva algunas si el mapa
  se satura.
- «Groups» enumera los grupos conectados de los tipos visibles y los tipos sin
  ninguna relación. Al hacer clic en un grupo se hace zoom sobre él y se
  enumeran sus miembros. Junto con los filtros, muestra qué partes del código
  están aisladas del resto, por ejemplo tras ocultar una interfaz de registro.
- Haz clic en un tipo para ver sus vecinos; haz doble clic para abrirlo en el
  editor.
- Filtra por tipo, proyecto y lenguaje, busca por nombre, o activa «Focus on
  selection» para ver solo un tipo y sus vecinos directos.
- Los espacios de nombres se pueden desactivar uno a uno en la lista
  «Namespaces» del panel lateral; el campo sobre la lista la reduce. Cada lista
  de filtros tiene «all» y «none» en su título; con la lista de espacios de
  nombres reducida, se aplican a los espacios listados.
- «Focus in map», en los detalles de la derecha, centra el mapa en el tipo
  seleccionado y sus vecinos, por ejemplo tras elegirlo en una lista de la izquierda.
- «Export…» guarda el mapa tal como se muestra (con filtros, grupos contraídos
  y marcos de espacios de nombres) como PNG, SVG, Mermaid, Graphviz DOT o JSON.
- «Compare with Git…» pide una rama, etiqueta o commit y analiza esa versión en
  una copia temporal (tu directorio de trabajo no se toca; los paquetes se
  restauran allí). Los tipos y dependencias nuevos reciben un borde o una línea
  verde, los eliminados se dibujan de nuevo como «fantasmas» rojos
  discontinuos, y el panel lateral enumera los cambios. «Clear comparison»
  quita las marcas. Requiere un repositorio Git y acceso a los orígenes de
  paquetes.

### Reglas de arquitectura

Las reglas de arquitectura describen cómo *debe* estar construida la solución;
el mapa muestra después dónde el código hace otra cosa. Un ejemplo típico: la
capa de dominio no debe conocer la capa de base de datos. Nada impide que un
`using Shop.Infrastructure` se cuele en una clase de dominio, pero con una
regla esa dependencia se dibuja en rojo y se enumera.

**Primeros pasos**

1. Pulsa «Create rules file» en «Architecture rules», en el panel lateral del
   mapa. Esto crea `.atlas.json` junto a la solución, con el prefijo de espacio
   de nombres más frecuente de tu código como punto de partida.
2. Adapta las capas a tus espacios de nombres o proyectos y añade reglas.
3. Pulsa «Reload» en el mapa. La comprobación se ejecuta de inmediato; no hace
   falta un nuevo análisis.

El archivo se busca primero junto a la solución y después en las carpetas del
espacio de trabajo. El nombre se cambia con el ajuste `dotnetAtlas.rulesFile`.
El mapa de ejemplo («Open sample map») trae reglas propias, así que puedes ver
una infracción sin configurar nada.

**El archivo**

```json
{
  "layers": [
    { "name": "Domain",         "namespaces": ["Shop.Domain", "Shop.Domain.*"] },
    { "name": "Application",    "namespaces": ["Shop.Application", "Shop.Application.*"] },
    { "name": "Infrastructure", "projects": ["Shop.Infrastructure"] },
    { "name": "Web",            "projects": ["Shop.Web"] }
  ],
  "rules": [
    { "from": "Domain",         "canOnlyUse": [] },
    { "from": "Application",    "canOnlyUse": ["Domain"] },
    { "from": "Infrastructure", "cannotUse": ["Web"] }
  ]
}
```

Las *capas* (`layers`) agrupan los tipos de la solución:

- `name` es el nombre con el que las reglas se refieren a la capa.
- `namespaces` y `projects` son listas de patrones. Un tipo pertenece a la capa
  si su espacio de nombres o el nombre de su proyecto (sin `.csproj`) coincide
  con alguno. Puedes usar una de las listas o ambas.
- En un patrón, `*` representa cualquier carácter, puntos incluidos; el resto
  se toma literalmente, distingue mayúsculas de minúsculas, y el patrón debe
  coincidir con el nombre completo. Por eso `Shop.Domain*` también coincide con
  `Shop.DomainTools`. Para el espacio de nombres y todo lo que hay debajo, y
  nada más, escribe `Shop.Domain` y `Shop.Domain.*`.
- Si coinciden varias capas, vale la primera del archivo. Pon las capas
  específicas antes que las generales.

Las *reglas* (`rules`) limitan lo que una capa puede usar:

- `from` es la capa a la que se refiere la regla.
- `cannotUse` enumera las capas que no se pueden usar.
- `canOnlyUse` enumera las únicas capas que se pueden usar. Una lista vacía
  significa «ninguna»: la capa no puede depender de ninguna otra.
- Una capa puede tener varias reglas, y una regla puede llevar ambas listas.
- Una regla limita las dependencias que *salen* de una capa. Para expresar
  «solo Application puede usar Infrastructure», escribe reglas para las demás
  capas (`cannotUse` o `canOnlyUse`), no para Infrastructure.

**Qué cuenta como infracción**

- Una relación de un tipo de la capa A a un tipo de la capa B que una regla de
  A prohíbe. Cuenta cualquier clase de relación: herencia, uso de un tipo,
  llamadas, accesos, registros, eventos y atributos.
- Siempre se permiten las dependencias dentro de una capa, las dependencias de
  y hacia tipos sin capa, y las capas sin regla.
- La comprobación trabaja con lo que dejan pasar los filtros. Si ocultas «Uses
  types» o un proyecto, desaparecen también las infracciones formadas por esas
  relaciones o tipos. Para una comprobación completa, activa todas las
  relaciones.
- Contraer espacios de nombres o proyectos solo cambia el dibujo; las reglas se
  comprueban sobre los tipos.

**En el mapa**

- Las relaciones que infringen una regla se dibujan gruesas y en rojo. «Mark
  rule violations», en «Analysis», desactiva la marca.
- «Architecture rules», en el panel lateral, muestra cuántas capas hay, a
  cuántos tipos se les asignó una capa (un número bajo suele indicar que los
  patrones no coinciden con tus espacios de nombres) y cada infracción con la
  regla que incumple. Un clic en una entrada la localiza en el mapa.
- Los errores del archivo (un nombre de capa desconocido, una capa sin
  patrones, una regla sin `cannotUse` ni `canOnlyUse`) se enumeran allí; el
  resto del archivo sigue vigente.

**Consejos**

- Empieza con la una o dos reglas más importantes, por ejemplo «Domain solo
  puede usar Domain», y añade más cuando estén limpias.
- El lugar donde se ensambla la aplicación (`Program.cs`, una clase de inicio)
  conoce legítimamente todas las capas, y los registros en el contenedor de
  inyección de dependencias cuentan como relaciones. Dale a ese código una capa
  sin reglas o déjalo fuera.
- Las infracciones existentes no son motivo para renunciar a una regla: el
  número del panel lateral muestra si baja con el tiempo. Junto con «Compare
  with Git…» también ves qué infracciones introduce una rama.

### Mantener el mapa al día

El mapa es una instantánea. Mientras está abierto, la extensión vigila los archivos
fuente de la solución (`.cs`, `.vb`, archivos de proyecto, `.xaml`, `.axaml`; no
`bin`, `obj` ni `node_modules`). Tras un cambio aparece una barra sobre la barra de
herramientas con el número de archivos modificados. «Reload map» analiza la solución
de nuevo (también con el comando «Analyze the solution of the open map again»),
«Dismiss» oculta la barra. Al recargar vuelven los filtros predeterminados y se
borra la comparación con Git.

### Tipos sin usar

«Unused candidates» en la barra lateral enumera los tipos a los que nada en el código
analizado hace referencia. Son solo candidatos: un tipo que crea el propio framework no
tiene referencias en el código y parece sin usar. Casos típicos son las ventanas y
controles de WPF que solo se enlazan en XAML, los controladores, los servicios
hospedados, las clases de prueba y los tipos que se crean mediante reflexión o
inyección de dependencias.

Por eso, de forma predeterminada se omiten los siguientes, y la lista indica cuántos
tipos se ocultaron y por qué:

- tipos derivados de clases de WPF, Avalonia, WinUI, MAUI o Xamarin.Forms, de
  controladores de ASP.NET Core, Razor Pages, componentes Blazor, hubs de SignalR,
  servicios hospedados y servicios de Windows
- tipos con atributos de pruebas o MEF (xUnit, NUnit, MSTest, `System.ComponentModel.Composition`)
- tipos con un método `Main`

Tus propias excepciones van en `ignoreUnused` del archivo de reglas (los patrones
funcionan como los de las capas, `*` equivale a cualquier carácter). El archivo puede
contener solo esta parte. `types` coincide con el nombre completo, `baseTypes` con las
clases base e interfaces (también las del framework, como nombres completos sin
argumentos de tipo) y `attributes` con las clases de atributo del tipo y sus miembros.

```json
{
  "ignoreUnused": {
    "namespaces": ["Shop.Generated*"],
    "types": ["Shop.Api.Startup"],
    "baseTypes": ["Shop.Plugins.IPlugin"],
    "attributes": ["Shop.Serialization.*"]
  }
}
```

La casilla «Apply exceptions» desactiva todas las excepciones.

**XAML.** El analizador también lee los archivos `.xaml` y `.axaml` de los
proyectos. Un tipo que nombra un archivo XAML (como elemento, por ejemplo
`<local:OrderView/>`, en `{x:Type}`, `{x:Static}`, una extensión de marcado, una
propiedad adjunta o como destino de un estilo o plantilla) queda referenciado por
el tipo de ese archivo (`x:Class`) mediante la relación «XAML references». Una
ventana iniciada con `StartupUri` y los diccionarios de recursos combinados también
cuentan; los diccionarios de recursos se atribuyen a la clase `Application`. No se
detectan las referencias que solo existen en tiempo de ejecución: una ventana abierta
a partir de una cadena, enlaces por nombre de propiedad, un `DataContext` asignado en
el código. Con `dotnetAtlas.analyzeXaml` en `false` se omiten los archivos XAML.

**Excepciones globales.** El ajuste `dotnetAtlas.ignoreUnused` tiene las mismas
claves que el archivo de reglas y vale para todas las soluciones. Con
`dotnetAtlas.ignoreUnusedDefaults` en `false` se quitan las excepciones integradas.
Las excepciones integradas, el ajuste y el archivo de reglas se suman.

### Lenguajes compatibles

C# y Visual Basic, en la misma solución si hace falta. F# no es compatible,
porque Roslyn no lo analiza. Un módulo de Visual Basic se muestra como clase
estática; el espacio de nombres `My`, generado por el compilador, se omite.

En una solución que mezcla ambos, las relaciones entre los lenguajes se
muestran como cualquier otra, y aparece un filtro «Languages» para ver por
separado la parte en C# y la parte en Visual Basic.

### Ajustes

| Ajuste                     | Valor por defecto | Significado                                                                      |
| -------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| `dotnetAtlas.dotnetPath`   | `dotnet`          | Ruta o nombre del ejecutable de dotnet con el que se inicia el analizador        |
| `dotnetAtlas.analyzerPath` | vacío             | Ruta a `Atlas.Analyzer.dll`; vacío usa el analizador incluido en la extensión    |
| `dotnetAtlas.zoomSpeed`    | `1`               | Velocidad del zoom con la rueda del ratón (0,1 a 10), se aplica al abrir el siguiente mapa |
| `dotnetAtlas.namespaceGrouping` | `off` | Marcos de espacios de nombres al abrir el mapa: `off`, `grouped` o `nested` (se cambia en la barra de herramientas) |
| `dotnetAtlas.rulesFile` | `.atlas.json` | Nombre del archivo con las reglas de arquitectura, se busca junto a la solución y en las carpetas del espacio de trabajo |
| `dotnetAtlas.analyzeXaml` | `true` | Lee los archivos XAML de los proyectos, para que los tipos usados solo en XAML no aparezcan como sin usar. Se aplica desde el siguiente análisis |
| `dotnetAtlas.ignoreUnused` | `{}` | Tipos que nunca se listan como sin usar, para todas las soluciones (`namespaces`, `types`, `baseTypes`, `attributes`; `*` equivale a cualquier carácter) |
| `dotnetAtlas.ignoreUnusedDefaults` | `true` | Aplica las excepciones integradas para los candidatos sin usar (WPF, ASP.NET Core, pruebas, `Main`, ...) |
| `dotnetAtlas.analyzeXaml` | `true` | Читать файлы XAML проектов, чтобы типы, используемые только в XAML, не считались неиспользуемыми. Вступает в силу при следующем анализе |
| `dotnetAtlas.ignoreUnused` | `{}` | Типы, которые никогда не попадают в список неиспользуемых, для всех решений (`namespaces`, `types`, `baseTypes`, `attributes`; `*` заменяет любые символы) |
| `dotnetAtlas.ignoreUnusedDefaults` | `true` | Применять встроенные исключения для неиспользуемых кандидатов (WPF, ASP.NET Core, тесты, `Main` и др.) |
| `dotnetAtlas.analyzeXaml` | `true` | 读取项目中的 XAML 文件，使只在 XAML 中使用的类型不会显示为未使用。下次分析时生效 |
| `dotnetAtlas.ignoreUnused` | `{}` | 永不列为未使用的类型，对所有解决方案生效（`namespaces`、`types`、`baseTypes`、`attributes`；`*` 匹配任意字符） |
| `dotnetAtlas.ignoreUnusedDefaults` | `true` | 应用未使用候选的内置例外（WPF、ASP.NET Core、测试、`Main` 等） |
| `dotnetAtlas.analyzeXaml` | `true` | Liest die XAML-Dateien der Projekte, damit Typen, die nur in XAML benutzt werden, nicht als ungenutzt erscheinen. Gilt ab der nächsten Analyse |
| `dotnetAtlas.ignoreUnused` | `{}` | Typen, die nie als ungenutzt aufgelistet werden, für alle Solutions (`namespaces`, `types`, `baseTypes`, `attributes`; `*` steht für beliebige Zeichen) |
| `dotnetAtlas.ignoreUnusedDefaults` | `true` | Wendet die eingebauten Ausnahmen für ungenutzte Kandidaten an (WPF, ASP.NET Core, Tests, `Main`, ...) |
| `dotnetAtlas.analyzeXaml` | `true` | Read the XAML files of the projects, so that types used only in XAML are not shown as unused. Takes effect with the next analysis |
| `dotnetAtlas.ignoreUnused` | `{}` | Types that are never listed as unused, for all solutions (`namespaces`, `types`, `baseTypes`, `attributes`; `*` matches any characters) |
| `dotnetAtlas.ignoreUnusedDefaults` | `true` | Apply the built-in exceptions for unused candidates (WPF, ASP.NET Core, tests, `Main`, ...) |

### Requisitos

- Visual Studio Code 1.85 o superior
- SDK de .NET 8.0 o superior (lo necesita el analizador para cargar tu solución)
- Node.js 20 o superior (solo para compilar la extensión)

### Estructura del repositorio

| Ruta         | Contenido                                        |
| ------------ | ------------------------------------------------ |
| `analyzer/`  | herramienta de consola de .NET (Roslyn) y sus pruebas |
| `extension/` | extensión de VS Code (TypeScript, webview)       |

### Licencia

MIT, consulta [LICENSE](LICENSE). Se puede usar, modificar y distribuir libremente. Los componentes de terceros utilizados (Cytoscape.js, dagre, cytoscape-dagre, Roslyn, MSBuild Locator) también tienen licencia MIT.

[Volver arriba](#dotnet-solution-atlas)
