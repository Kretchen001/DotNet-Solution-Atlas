<!-- Maintainers: keep all five language sections in sync, in this order: English, Deutsch, 中文, Русский, Español. -->

# DotNet Solution Atlas

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
- Relationships: inheritance, implementation, use of types, method calls and
  property/field access, each of them can be switched on and off
- Layered layout, so that interfaces and implementations are easy to tell apart
- Filters by type kind, project and language; search by name
- Focus mode: only the selected type and its neighbours
- Group by namespace: dashed frames around the types of each namespace (switchable)
- Details pane with metrics, and jump to the source file
- Groups: connected groups of types and types without any relationship, to
  find parts of the code that are cut off from the rest

### Planned features

- Filter by namespace
- Heatmap by coupling to find hubs, and detection of dependency cycles
- Namespaces and projects as visual groups
- Export as SVG or PNG

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
  - purple dotted line: a property, indexer, field or event is accessed
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

### Requirements

- Visual Studio Code 1.85 or newer
- .NET SDK 8.0 or newer (needed by the analyzer to load your solution)
- Node.js 20 or newer (only to build the extension)

### Repository layout

| Path         | Content                                 |
| ------------ | --------------------------------------- |
| `analyzer/`  | .NET console tool (Roslyn)              |
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
- Beziehungen: Vererbung, Implementierung, Verwendung von Typen, Methodenaufrufe
  und Property-/Feldzugriffe, jede Art lässt sich einzeln ein- und ausschalten
- Geschichtetes Layout, damit sich Interfaces und Implementierungen gut
  unterscheiden lassen
- Filter nach Typart, Projekt und Sprache; Suche nach Namen
- Fokusmodus: nur der gewählte Typ und seine Nachbarn
- Nach Namespace gruppieren: gestrichelte Rahmen um die Typen jedes Namespace (schaltbar)
- Detailbereich mit Kennzahlen und Sprung zur Quelldatei
- Gruppen: zusammenhängende Gruppen von Typen und Typen ohne jede Beziehung, um
  vom Rest abgeschnittene Teile des Codes zu finden

### Geplante Funktionen

- Filter nach Namespace
- Heatmap nach Kopplung, um Knotenpunkte zu finden, und Erkennung von
  Abhängigkeitszyklen
- Namespaces und Projekte als visuelle Gruppen
- Export als SVG oder PNG

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
  - lila gepunktete Linie: auf eine Property, einen Indexer, ein Feld oder ein
    Event wird zugegriffen
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

### Voraussetzungen

- Visual Studio Code 1.85 oder neuer
- .NET SDK 8.0 oder neuer (der Analyzer braucht es, um deine Solution zu laden)
- Node.js 20 oder neuer (nur zum Bauen der Erweiterung)

### Aufbau des Repositorys

| Pfad         | Inhalt                                       |
| ------------ | -------------------------------------------- |
| `analyzer/`  | .NET-Konsolenprogramm (Roslyn)               |
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
- 关系：继承、实现、类型使用、方法调用、属性/字段访问，每一种都可以单独开关
- 分层布局，方便区分接口和实现
- 按类型种类、项目和语言过滤；按名称搜索
- 聚焦模式：只显示选中的类型及其相邻类型
- 按命名空间分组：在每个命名空间的类型周围绘制虚线框（可开关）
- 详情面板显示统计信息，并可跳转到源文件
- 分组：显示相互连通的类型组，以及没有任何关系的类型，用于找出与其余代码隔离的部分

### 计划中的功能

- 按命名空间过滤
- 按耦合度生成热力图以找出枢纽，并检测依赖循环
- 将命名空间和项目显示为可视化分组
- 导出为 SVG 或 PNG

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
  - 紫色点线：访问了属性、索引器、字段或事件
- 每一种关系都可以在“Relationships”过滤器中单独开关。默认全部显示；
  如果地图过于拥挤，可以关闭其中一些。
- “Groups”列出可见类型中相互连通的组，以及没有任何关系的类型。点击某个组会缩放到该组，
  并列出其成员。结合过滤器，可以看出哪些代码与其余部分隔离，例如隐藏日志接口之后。
- 点击类型可查看其相邻类型，双击可在编辑器中打开。
- 可按类型种类、项目和语言过滤，按名称搜索，或开启“Focus on selection”，
  只查看某个类型及其直接相邻的类型。

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

### 环境要求

- Visual Studio Code 1.85 或更高版本
- .NET SDK 8.0 或更高版本（分析器需要它来加载你的解决方案）
- Node.js 20 或更高版本（仅用于构建扩展）

### 仓库结构

| 路径         | 内容                                  |
| ------------ | ------------------------------------- |
| `analyzer/`  | .NET 命令行工具（Roslyn）             |
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
- Связи: наследование, реализация, использование типов, вызовы методов и доступ
  к свойствам и полям; каждый вид можно включать и отключать отдельно
- Многоуровневая раскладка, чтобы интерфейсы и реализации легко различались
- Фильтры по виду типа, проекту и языку; поиск по имени
- Режим фокуса: только выбранный тип и его соседи
- Группировка по пространствам имён: пунктирные рамки вокруг типов каждого пространства (переключается)
- Панель сведений с метриками и переход к исходному файлу
- Группы: связные группы типов и типы без каких-либо связей — для поиска частей
  кода, отрезанных от остального

### Планируемые возможности

- Фильтр по пространству имён
- Тепловая карта по степени связанности для поиска узловых точек и обнаружение
  циклических зависимостей
- Пространства имён и проекты как визуальные группы
- Экспорт в SVG или PNG

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
  - фиолетовая точечная линия: выполняется обращение к свойству, индексатору,
    полю или событию
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

### Требования

- Visual Studio Code 1.85 или новее
- .NET SDK 8.0 или новее (нужен анализатору для загрузки вашего решения)
- Node.js 20 или новее (только для сборки расширения)

### Структура репозитория

| Путь         | Содержимое                                       |
| ------------ | ------------------------------------------------ |
| `analyzer/`  | консольная утилита .NET (Roslyn)                 |
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
- Relaciones: herencia, implementación, uso de tipos, llamadas a métodos y
  acceso a propiedades y campos; cada una se puede activar y desactivar por
  separado
- Diseño por capas, para distinguir fácilmente interfaces e implementaciones
- Filtros por tipo, proyecto y lenguaje; búsqueda por nombre
- Modo de enfoque: solo el tipo seleccionado y sus vecinos
- Agrupar por espacio de nombres: marcos discontinuos alrededor de los tipos de cada espacio (activable)
- Panel de detalles con métricas y salto al archivo de origen
- Grupos: grupos conectados de tipos y tipos sin ninguna relación, para
  encontrar partes del código aisladas del resto

### Funciones previstas

- Filtro por espacio de nombres
- Mapa de calor por acoplamiento para encontrar puntos clave, y detección de
  ciclos de dependencia
- Espacios de nombres y proyectos como grupos visuales
- Exportación como SVG o PNG

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
  - línea morada de puntos: se accede a una propiedad, indizador, campo o evento
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

### Requisitos

- Visual Studio Code 1.85 o superior
- SDK de .NET 8.0 o superior (lo necesita el analizador para cargar tu solución)
- Node.js 20 o superior (solo para compilar la extensión)

### Estructura del repositorio

| Ruta         | Contenido                                        |
| ------------ | ------------------------------------------------ |
| `analyzer/`  | herramienta de consola de .NET (Roslyn)          |
| `extension/` | extensión de VS Code (TypeScript, webview)       |

### Licencia

MIT, consulta [LICENSE](LICENSE). Se puede usar, modificar y distribuir libremente. Los componentes de terceros utilizados (Cytoscape.js, dagre, cytoscape-dagre, Roslyn, MSBuild Locator) también tienen licencia MIT.

[Volver arriba](#dotnet-solution-atlas)
