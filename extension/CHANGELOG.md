# Changelog

<!-- Maintainers: keep all five languages in sync, same order as in the README. -->

**English** · [Deutsch](#deutsch) · [中文](#中文) · [Русский](#русский) · [Español](#español)

All notable changes to **DotNet Solution Atlas** are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/).

---

## English

### 1.1.2 – 2026-11-07

- Fixed: types that cannot be resolved (missing references in projects that were read from their files) no longer end the analysis with "Object reference not set to an instance of an object". The analyzer prints the stack trace of a failure.
- Fixed: a solution with projects that MSBuild cannot load (COM references that only build with Visual Studio's MSBuild, a failing .NET Framework build host: `TypeLoadException ... ProjectCacheService`) no longer ends in "Analysis failed". The projects are tried one by one, and those that come back empty or not at all are read from their source files on disk (`[Fallback]` in the output).

### 1.1.1 – 2026-11-07

- Added: `scripts/build-local.ps1` tests, builds and packages the extension on Windows and shows how to install the `.vsix`.
- Changed: the README shows the icon, describes how to build from source and has an up-to-date status note (five languages).

### 1.1.0 – 2026-11-07

- Added: XAML files (`.xaml`, `.axaml`) are read. Types that are only used there (windows, user controls, converters, view models) get a new "XAML references" relationship and no longer appear as unused. Setting `dotnetAtlas.analyzeXaml` switches it off.
- Added: global exceptions for unused candidates with the settings `dotnetAtlas.ignoreUnused` and `dotnetAtlas.ignoreUnusedDefaults`.
- Added: when source files change, the map shows a bar with a "Reload map" button (command "Analyze the solution of the open map again").
- Added: types that a framework wires up by itself (WPF/XAML, ASP.NET Core, hosted services, test classes, `Main`) no longer appear under "Unused candidates"; the list shows how many were hidden and why. Own exceptions go under `ignoreUnused` in the rules file; a checkbox switches them off.
- Added: namespaces can be switched off one by one ("Namespaces" list in the sidebar, with a box to narrow it).
- Added: "all / none" in the heading of every filter list (relationships, types, languages, projects, namespaces).

### 1.0.0 – 2026-11-07

- First stable version. It contains everything from the 0.x versions: the map with relationships, namespace frames, collapsing, analysis, architecture rules, members, export and the comparison with Git.
- Added: the architecture rules are explained in detail in the README (getting started, the file format, patterns, what counts as a violation, tips), in five languages.
- Added: "Focus in map" in the details pane centres the map on the selected type or group.
- Changed: large maps load and react much faster. Beyond 80 types, or when the types are densely connected, a faster layered layout replaces dagre; large maps are drawn with straight lines. 1000 types with 5000 relationships load in about 3 seconds.

### 0.6.0 – 2026-11-07

- Added: compare the open map with a Git commit, branch or tag ("Compare with Git…" in the toolbar, also a command). New types and dependencies are marked in green, removed ones are drawn again as red dashed ghosts, and the sidebar lists the changes. The revision is analyzed in a temporary checkout; your working directory is not touched.

### 0.5.0 – 2026-11-07

- Added: export of the map as shown (filters, collapsed groups and namespace frames included): PNG, SVG, Mermaid, Graphviz DOT and JSON ("Export…" in the toolbar).
- Added: three new relationships, each with its own filter entry: `registers` (dependency injection registrations such as `AddScoped<IOrders, Orders>()`, `AddHostedService<T>()`, also the `typeof` overloads), `events` (subscribing to, unsubscribing from and raising events; before, these were property accesses) and `annotated` (attributes; before, these were plain uses).
- Added: tests for the analyzer (xUnit, in-memory workspace) and a GitHub Actions workflow that builds and tests the analyzer and the extension.
- Fixed: with namespace frames on, two types of one frame could be drawn on top of each other.

### 0.4.0 – 2026-11-07

- Added: analysis in the sidebar: dependency cycles between types, namespaces and projects (marked in red), hub ranking, candidates for unused types, and node height by coupling, usage or size.
- Added: architecture rules in `.atlas.json` (layers, `cannotUse`, `canOnlyUse`); violations are drawn in red and listed. Setting `dotnetAtlas.rulesFile`.
- Added: collapse namespaces or projects into one node (toolbar); double-click opens a group.
- Added: members of a type with what each calls, accesses or uses, in the details pane. The analyzer writes them as `memberDetails`.
- Added: namespace frames in the map (toolbar choice Off, Grouped, Nested); nested frames place a namespace inside its parent namespace. Starting value: setting `dotnetAtlas.namespaceGrouping`.
- Changed: the map opens in the active editor group instead of beside it; code opened from the map goes beside the map.

### 0.3.0 – 2026-11-07

- Added: project icon (a folded map with a coastline) for the extension and, in a single-colour version, for the Activity Bar.
- Added: an entry in the Activity Bar (left side bar) with a view that opens the map of the solution or the sample map.
- Changed: the bundled analyzer is smaller (English resources only, no debug symbols).
- Added: this changelog, in five languages.

### 0.2.0 – 2026-11-06

- Added: Visual Basic support, including solutions that mix C# and Visual Basic; new "Languages" filter (shown only for mixed solutions).
- Changed: README in five languages; project released under the MIT license.

### 0.1.0 – 2026-11-06

- First version: Roslyn-based analyzer for C# solutions and projects, interactive map in a VS Code panel, sample map.
- Relationships `inherits`, `implements`, `uses`, `calls` and `accesses` (method calls, property and field accesses, also to static classes), each switchable in the filter.
- Delegates as their own type kind; generic constraints and top-level statements are taken into account.
- Groups and isolated partitions, focus mode, search and a details pane.
- Setting `dotnetAtlas.zoomSpeed` for the mouse wheel zoom.
- The analyzer runs with .NET SDKs newer than its target runtime (roll forward) and reports a missing SDK clearly.

---

## Deutsch

### 1.1.2 – 2026-11-07

- Behoben: Typen, die sich nicht auflösen lassen (fehlende Verweise in Projekten, die aus ihren Dateien gelesen wurden), beenden die Analyse nicht mehr mit „Object reference not set to an instance of an object“. Der Analyzer gibt bei einem Fehler den Stacktrace aus.
- Behoben: Eine Solution mit Projekten, die MSBuild nicht laden kann (COM-Verweise, die sich nur mit dem MSBuild von Visual Studio bauen lassen; ein ausfallender .NET-Framework-Build-Host: `TypeLoadException ... ProjectCacheService`), endet nicht mehr mit „Analysis failed“. Die Projekte werden einzeln versucht, und solche, die leer oder gar nicht zurückkommen, werden aus ihren Quelldateien auf der Festplatte gelesen (`[Fallback]` in der Ausgabe).

### 1.1.1 – 2026-11-07

- Neu: `scripts/build-local.ps1` testet, baut und verpackt die Erweiterung unter Windows und zeigt, wie man die `.vsix` installiert.
- Geändert: Das README zeigt das Icon, beschreibt das Bauen aus dem Quellcode und hat einen aktuellen Status-Hinweis (fünf Sprachen).

### 1.1.0 – 2026-11-07

- Neu: XAML-Dateien (`.xaml`, `.axaml`) werden gelesen. Typen, die nur dort benutzt werden (Fenster, UserControls, Converter, ViewModels), erhalten die neue Beziehung „XAML references“ und erscheinen nicht mehr als ungenutzt. Die Einstellung `dotnetAtlas.analyzeXaml` schaltet das ab.
- Neu: globale Ausnahmen für ungenutzte Kandidaten über die Einstellungen `dotnetAtlas.ignoreUnused` und `dotnetAtlas.ignoreUnusedDefaults`.
- Neu: Ändern sich Quelldateien, zeigt die Karte einen Hinweis mit der Schaltfläche „Reload map“ (Befehl „Analyze the solution of the open map again“).
- Neu: Typen, die ein Framework selbst einbindet (WPF/XAML, ASP.NET Core, Hosted Services, Testklassen, `Main`), erscheinen nicht mehr unter „Unused candidates“; die Liste zeigt, wie viele ausgeblendet wurden und warum. Eigene Ausnahmen stehen unter `ignoreUnused` in der Regeldatei; ein Kontrollkästchen schaltet sie ab.
- Neu: Namespaces lassen sich einzeln ausschalten (Liste „Namespaces“ in der Seitenleiste, mit einem Feld zum Eingrenzen).
- Neu: „all / none“ in der Überschrift jeder Filterliste (Beziehungen, Typen, Sprachen, Projekte, Namespaces).

### 1.0.0 – 2026-11-07

- Erste stabile Version. Sie enthält alles aus den 0.x-Versionen: die Karte mit Beziehungen, Namespace-Rahmen, Zusammenfassen, Analyse, Architekturregeln, Member, Export und den Vergleich mit Git.
- Neu: Die Architekturregeln sind im README ausführlich erklärt (erste Schritte, Dateiformat, Muster, was als Verstoß zählt, Tipps), in fünf Sprachen.
- Neu: „Focus in map“ im Detailbereich zentriert die Karte auf den gewählten Typ oder die gewählte Gruppe.
- Geändert: Große Karten laden und reagieren deutlich schneller. Ab 80 Typen oder bei dicht verbundenen Typen ersetzt ein schnelleres Ebenen-Layout dagre; große Karten werden mit geraden Linien gezeichnet. 1000 Typen mit 5000 Beziehungen laden in etwa 3 Sekunden.

### 0.6.0 – 2026-11-07

- Neu: die geöffnete Karte mit einem Git-Commit, Branch oder Tag vergleichen („Compare with Git…“ in der Werkzeugleiste, auch als Befehl). Neue Typen und Abhängigkeiten werden grün markiert, entfernte als rote gestrichelte Geister erneut gezeichnet, und die Seitenleiste listet die Änderungen. Der Stand wird in einem temporären Checkout analysiert; dein Arbeitsverzeichnis bleibt unberührt.

### 0.5.0 – 2026-11-07

- Neu: Export der Karte, wie sie angezeigt wird (mit Filtern, zusammengefassten Gruppen und Namespace-Rahmen): PNG, SVG, Mermaid, Graphviz DOT und JSON („Export…“ in der Werkzeugleiste).
- Neu: drei weitere Beziehungen mit eigenem Filtereintrag: `registers` (Registrierungen für Dependency Injection wie `AddScoped<IOrders, Orders>()`, `AddHostedService<T>()`, auch die `typeof`-Überladungen), `events` (Abonnieren, Abbestellen und Auslösen von Events; vorher Property-Zugriffe) und `annotated` (Attribute; vorher einfache Verwendung).
- Neu: Tests für den Analyzer (xUnit, Workspace im Speicher) und ein GitHub-Actions-Workflow, der Analyzer und Erweiterung baut und testet.
- Behoben: Bei eingeschalteten Namespace-Rahmen konnten zwei Typen eines Rahmens übereinander gezeichnet werden.

### 0.4.0 – 2026-11-07

- Neu: Analyse in der Seitenleiste: Abhängigkeitszyklen zwischen Typen, Namespaces und Projekten (rot markiert), Ranking der Knotenpunkte, Kandidaten für ungenutzte Typen und Knotenhöhe nach Kopplung, Nutzung oder Größe.
- Neu: Architekturregeln in `.atlas.json` (Schichten, `cannotUse`, `canOnlyUse`); Verstöße werden rot gezeichnet und aufgelistet. Einstellung `dotnetAtlas.rulesFile`.
- Neu: Namespaces oder Projekte zu einem Knoten zusammenfassen (Werkzeugleiste); Doppelklick öffnet eine Gruppe.
- Neu: Member eines Typs mit dem, was jeder aufruft, anspricht oder verwendet, im Detailbereich. Der Analyzer schreibt sie als `memberDetails`.
- Neu: Namespace-Rahmen in der Karte (Auswahl in der Werkzeugleiste: Off, Grouped, Nested); verschachtelt liegt ein Namespace im Rahmen seines übergeordneten Namespace. Startwert: Einstellung `dotnetAtlas.namespaceGrouping`.
- Geändert: Die Karte öffnet sich in der aktiven Editorgruppe statt daneben; aus der Karte geöffneter Code erscheint neben der Karte.

### 0.3.0 – 2026-11-07

- Neu: Projekt-Icon (gefaltete Landkarte mit Küstenlinie) für die Extension und, einfarbig, für die Activity Bar.
- Neu: Eintrag in der Activity Bar (linke Seitenleiste) mit einer Ansicht, die die Karte der Solution oder die Beispielkarte öffnet.
- Geändert: Der mitgelieferte Analyzer ist kleiner (nur englische Ressourcen, keine Debug-Symbole).
- Neu: dieses Änderungsprotokoll in fünf Sprachen.

### 0.2.0 – 2026-11-06

- Neu: Visual-Basic-Unterstützung, auch für Solutions mit gemischtem C# und Visual Basic; neuer Filter „Languages“ (nur bei gemischten Solutions sichtbar).
- Geändert: README in fünf Sprachen; Projekt unter der MIT-Lizenz veröffentlicht.

### 0.1.0 – 2026-11-06

- Erste Version: Roslyn-basierter Analyzer für C#-Solutions und -Projekte, interaktive Karte in einem VS-Code-Panel, Beispielkarte.
- Beziehungen `inherits`, `implements`, `uses`, `calls` und `accesses` (Methodenaufrufe, Property- und Feldzugriffe, auch auf statische Klassen), jeweils im Filter schaltbar.
- Delegates als eigene Typart; generische Constraints und Top-Level-Statements werden berücksichtigt.
- Gruppen und isolierte Partitionen, Fokusmodus, Suche und Detailbereich.
- Einstellung `dotnetAtlas.zoomSpeed` für das Zoomen mit dem Mausrad.
- Der Analyzer läuft auch mit neueren .NET-SDKs als seine Ziel-Runtime (Roll-Forward) und meldet ein fehlendes SDK verständlich.

---

## 中文

### 1.1.2 – 2026-11-07

- 修复：无法解析的类型（从文件读取的项目中缺少引用）不再使分析以“Object reference not set to an instance of an object”结束。分析器在失败时会输出堆栈跟踪。
- 修复：包含 MSBuild 无法加载的项目的解决方案（只能用 Visual Studio 的 MSBuild 构建的 COM 引用；失败的 .NET Framework 构建宿主：`TypeLoadException ... ProjectCacheService`）不再以“Analysis failed”结束。分析器会逐个尝试项目，对于返回为空或根本没有返回的项目，则从磁盘上的源文件读取（输出中为 `[Fallback]`）。

### 1.1.1 – 2026-11-07

- 新增：`scripts/build-local.ps1` 在 Windows 上测试、构建并打包扩展，并显示如何安装 `.vsix`。
- 变更：README 显示图标、说明如何从源代码构建，并更新了状态说明（五种语言）。

### 1.1.0 – 2026-11-07

- 新增：读取 XAML 文件（`.xaml`、`.axaml`）。只在其中使用的类型（窗口、用户控件、转换器、视图模型）获得新的“XAML references”关系，不再显示为未使用。设置项 `dotnetAtlas.analyzeXaml` 可将其关闭。
- 新增：通过设置项 `dotnetAtlas.ignoreUnused` 与 `dotnetAtlas.ignoreUnusedDefaults` 为未使用候选设置全局例外。
- 新增：源文件发生更改时，地图显示带有“Reload map”按钮的提示条（命令“Analyze the solution of the open map again”）。
- 新增：由框架自行接入的类型（WPF/XAML、ASP.NET Core、托管服务、测试类、`Main`）不再出现在“Unused candidates”中；列表会显示隐藏的数量及原因。自定义例外写在规则文件的 `ignoreUnused` 下，复选框可将其关闭。
- 新增：可以逐个关闭命名空间（侧边栏中的“Namespaces”列表，带有用于缩小范围的输入框）。
- 新增：每个过滤列表（关系、类型、语言、项目、命名空间）的标题中都有“all / none”。

### 1.0.0 – 2026-11-07

- 首个稳定版本。它包含 0.x 版本的全部功能：带关系的地图、命名空间框、折叠、分析、架构规则、成员、导出以及与 Git 的比较。
- 新增：README 中详细说明了架构规则（快速开始、文件格式、模式、什么算违规、提示），提供五种语言。
- 新增：详情面板中的“Focus in map”会将地图居中到所选类型或分组。
- 变更：大型地图的加载和响应明显更快。超过 80 个类型或类型之间连接密集时，由更快的分层布局取代 dagre；大型地图使用直线绘制。1000 个类型、5000 条关系约 3 秒即可加载。

### 0.6.0 – 2026-11-07

- 新增：将已打开的地图与 Git 提交、分支或标签比较（工具栏中的“Compare with Git…”，也可作为命令使用）。新增的类型和依赖以绿色标出，已删除的以红色虚线“幽灵”重新绘制，侧边栏列出所有变更。该版本在临时检出目录中分析，不会改动你的工作目录。

### 0.5.0 – 2026-11-07

- 新增：导出当前显示的地图（包含过滤结果、折叠的分组和命名空间框）：PNG、SVG、Mermaid、Graphviz DOT 和 JSON（工具栏中的“Export…”）。
- 新增：三种新的关系，各有独立的过滤项：`registers`（依赖注入注册，如 `AddScoped<IOrders, Orders>()`、`AddHostedService<T>()`，也包括 `typeof` 重载）、`events`（订阅、取消订阅和触发事件；此前算作属性访问）和 `annotated`（特性；此前算作普通使用）。
- 新增：分析器测试（xUnit，内存工作区）以及构建并测试分析器和扩展的 GitHub Actions 工作流。
- 修复：开启命名空间框时，同一个框内的两个类型可能被绘制在一起。

### 0.4.0 – 2026-11-07

- 新增：侧边栏分析：类型、命名空间和项目之间的依赖循环（以红色标出）、枢纽排名、可能未使用的类型，以及按耦合度、使用量或规模调整节点高度。
- 新增：`.atlas.json` 中的架构规则（层、`cannotUse`、`canOnlyUse`）；违规以红色绘制并列出。设置项 `dotnetAtlas.rulesFile`。
- 新增：将命名空间或项目折叠为一个节点（工具栏）；双击可展开分组。
- 新增：详情面板中显示类型的成员，以及每个成员调用、访问或使用了什么。分析器将其写为 `memberDetails`。
- 新增：地图中的命名空间框（工具栏选项 Off、Grouped、Nested）；嵌套时，命名空间位于其父命名空间的框内。初始值：设置 `dotnetAtlas.namespaceGrouping`。
- 变更：地图在当前编辑器组中打开，而不是在旁边；从地图打开的代码显示在地图旁边。

### 0.3.0 – 2026-11-07

- 新增：项目图标（带海岸线的折叠地图），用于扩展本身，并提供单色版本用于活动栏。
- 新增：在活动栏（左侧边栏）中加入入口，其视图可打开解决方案地图或示例地图。
- 变更：随扩展提供的分析器体积更小（仅英文资源，不含调试符号）。
- 新增：五种语言的更新日志（本文件）。

### 0.2.0 – 2026-11-06

- 新增：支持 Visual Basic，包括 C# 与 Visual Basic 混合的解决方案；新增“Languages”过滤器（仅在混合解决方案中显示）。
- 变更：README 提供五种语言；项目以 MIT 许可证发布。

### 0.1.0 – 2026-11-06

- 首个版本：基于 Roslyn 的 C# 解决方案与项目分析器，VS Code 面板中的交互式地图，示例地图。
- 关系类型 `inherits`、`implements`、`uses`、`calls` 与 `accesses`（方法调用、属性和字段访问，也包括对静态类的访问），可在过滤器中分别开关。
- 委托（delegate）作为独立的类型种类；同时考虑泛型约束和顶级语句。
- 分组与孤立分区、聚焦模式、搜索和详情面板。
- 设置项 `dotnetAtlas.zoomSpeed`，用于调整鼠标滚轮缩放速度。
- 分析器可在比目标运行时更新的 .NET SDK 下运行（向前兼容），缺少 SDK 时给出清晰提示。

---

## Русский

### 1.1.2 – 2026-11-07

- Исправлено: типы, которые не удаётся разрешить (отсутствующие ссылки в проектах, прочитанных из файлов), больше не приводят к завершению анализа с «Object reference not set to an instance of an object». При сбое анализатор выводит трассировку стека.
- Исправлено: решение с проектами, которые MSBuild не может загрузить (COM-ссылки, собирающиеся только MSBuild из Visual Studio; сбой узла сборки .NET Framework: `TypeLoadException ... ProjectCacheService`), больше не заканчивается сообщением «Analysis failed». Проекты пробуются по одному, а те, что вернулись пустыми или не вернулись совсем, читаются из исходных файлов на диске (в выводе `[Fallback]`).

### 1.1.1 – 2026-11-07

- Добавлено: `scripts/build-local.ps1` тестирует, собирает и упаковывает расширение в Windows и показывает, как установить `.vsix`.
- Изменено: README показывает значок, описывает сборку из исходного кода и содержит актуальную заметку о статусе (пять языков).

### 1.1.0 – 2026-11-07

- Добавлено: читаются файлы XAML (`.xaml`, `.axaml`). Типы, которые используются только в них (окна, пользовательские элементы управления, конвертеры, модели представления), получают новую связь «XAML references» и больше не считаются неиспользуемыми. Параметр `dotnetAtlas.analyzeXaml` отключает это.
- Добавлено: глобальные исключения для неиспользуемых кандидатов через параметры `dotnetAtlas.ignoreUnused` и `dotnetAtlas.ignoreUnusedDefaults`.
- Добавлено: при изменении исходных файлов карта показывает полосу с кнопкой «Reload map» (команда «Analyze the solution of the open map again»).
- Добавлено: типы, которые подключает сам фреймворк (WPF/XAML, ASP.NET Core, размещённые службы, тестовые классы, `Main`), больше не попадают в «Unused candidates»; список показывает, сколько скрыто и почему. Собственные исключения задаются в `ignoreUnused` в файле правил; флажок их отключает.
- Добавлено: пространства имён можно отключать по одному (список «Namespaces» в боковой панели с полем для сужения списка).
- Добавлено: «all / none» в заголовке каждого списка фильтров (связи, типы, языки, проекты, пространства имён).

### 1.0.0 – 2026-11-07

- Первая стабильная версия. Она включает всё из версий 0.x: карту со связями, рамки пространств имён, свёртку, анализ, архитектурные правила, члены, экспорт и сравнение с Git.
- Добавлено: архитектурные правила подробно описаны в README (начало работы, формат файла, шаблоны, что считается нарушением, советы) на пяти языках.
- Добавлено: «Focus in map» в панели сведений центрирует карту на выбранном типе или группе.
- Изменено: большие карты загружаются и реагируют заметно быстрее. Более чем при 80 типах или при плотно связанных типах dagre заменяет более быстрая послойная раскладка; большие карты рисуются прямыми линиями. 1000 типов с 5000 связями загружаются примерно за 3 секунды.

### 0.6.0 – 2026-11-07

- Добавлено: сравнение открытой карты с коммитом, веткой или тегом Git («Compare with Git…» на панели инструментов, также как команда). Новые типы и зависимости отмечаются зелёным, удалённые рисуются снова как красные пунктирные «призраки», а боковая панель перечисляет изменения. Состояние анализируется во временной копии; рабочий каталог не затрагивается.

### 0.5.0 – 2026-11-07

- Добавлено: экспорт карты в том виде, как она показана (с фильтрами, свёрнутыми группами и рамками пространств имён): PNG, SVG, Mermaid, Graphviz DOT и JSON («Export…» на панели инструментов).
- Добавлено: три новых вида связей, у каждого свой пункт в фильтре: `registers` (регистрации во внедрении зависимостей, например `AddScoped<IOrders, Orders>()`, `AddHostedService<T>()`, а также перегрузки с `typeof`), `events` (подписка, отписка и вызов событий; раньше это считалось обращением к свойствам) и `annotated` (атрибуты; раньше это считалось обычным использованием).
- Добавлено: тесты анализатора (xUnit, рабочая область в памяти) и рабочий процесс GitHub Actions, который собирает и тестирует анализатор и расширение.
- Исправлено: при включённых рамках пространств имён два типа одной рамки могли рисоваться друг поверх друга.

### 0.4.0 – 2026-11-07

- Добавлено: анализ в боковой панели: циклические зависимости между типами, пространствами имён и проектами (красным), рейтинг узловых точек, кандидаты на неиспользуемые типы и высота узла по связанности, использованию или размеру.
- Добавлено: архитектурные правила в `.atlas.json` (слои, `cannotUse`, `canOnlyUse`); нарушения рисуются красным и перечисляются. Параметр `dotnetAtlas.rulesFile`.
- Добавлено: свёртка пространств имён или проектов в один узел (панель инструментов); двойной щелчок раскрывает группу.
- Добавлено: члены типа с тем, что каждый из них вызывает, читает или использует, в панели сведений. Анализатор записывает их как `memberDetails`.
- Добавлено: рамки пространств имён на карте (выбор на панели инструментов: Off, Grouped, Nested); при вложенном режиме пространство имён лежит в рамке родительского. Начальное значение: параметр `dotnetAtlas.namespaceGrouping`.
- Изменено: карта открывается в активной группе редактора, а не рядом; код, открытый из карты, появляется рядом с картой.

### 0.3.0 – 2026-11-07

- Добавлено: значок проекта (сложенная карта с береговой линией) для расширения и, в одноцветном варианте, для панели действий.
- Добавлено: пункт в панели действий (левая боковая панель) с представлением, которое открывает карту решения или демонстрационную карту.
- Изменено: поставляемый анализатор стал меньше (только английские ресурсы, без отладочных символов).
- Добавлено: этот журнал изменений на пяти языках.

### 0.2.0 – 2026-11-06

- Добавлено: поддержка Visual Basic, в том числе для решений, где смешаны C# и Visual Basic; новый фильтр «Languages» (виден только в смешанных решениях).
- Изменено: README на пяти языках; проект выпущен под лицензией MIT.

### 0.1.0 – 2026-11-06

- Первая версия: анализатор решений и проектов C# на основе Roslyn, интерактивная карта в панели VS Code, демонстрационная карта.
- Связи `inherits`, `implements`, `uses`, `calls` и `accesses` (вызовы методов, обращения к свойствам и полям, в том числе к статическим классам), каждую можно включать и выключать в фильтре.
- Делегаты как отдельный вид типов; учитываются ограничения обобщений и операторы верхнего уровня.
- Группы и изолированные части, режим фокуса, поиск и панель сведений.
- Параметр `dotnetAtlas.zoomSpeed` для скорости масштабирования колесом мыши.
- Анализатор работает с более новыми .NET SDK, чем целевая среда выполнения (roll forward), и понятно сообщает об отсутствии SDK.

---

## Español

### 1.1.2 – 2026-11-07

- Corregido: los tipos que no se pueden resolver (referencias que faltan en proyectos leídos desde sus archivos) ya no terminan el análisis con «Object reference not set to an instance of an object». El analizador muestra el seguimiento de la pila de un fallo.
- Corregido: una solución con proyectos que MSBuild no puede cargar (referencias COM que solo se compilan con el MSBuild de Visual Studio; un host de compilación de .NET Framework que falla: `TypeLoadException ... ProjectCacheService`) ya no termina en «Analysis failed». Los proyectos se prueban uno a uno y los que vuelven vacíos o no vuelven se leen desde sus archivos fuente en el disco (`[Fallback]` en la salida).

### 1.1.1 – 2026-11-07

- Añadido: `scripts/build-local.ps1` prueba, compila y empaqueta la extensión en Windows y muestra cómo instalar el `.vsix`.
- Cambiado: el README muestra el icono, describe cómo compilar desde el código fuente y tiene una nota de estado actualizada (cinco idiomas).

### 1.1.0 – 2026-11-07

- Añadido: se leen los archivos XAML (`.xaml`, `.axaml`). Los tipos que solo se usan allí (ventanas, controles de usuario, convertidores, modelos de vista) reciben la nueva relación «XAML references» y ya no aparecen como sin usar. El ajuste `dotnetAtlas.analyzeXaml` lo desactiva.
- Añadido: excepciones globales para los candidatos sin usar con los ajustes `dotnetAtlas.ignoreUnused` y `dotnetAtlas.ignoreUnusedDefaults`.
- Añadido: cuando cambian los archivos fuente, el mapa muestra una barra con el botón «Reload map» (comando «Analyze the solution of the open map again»).
- Añadido: los tipos que el propio framework enlaza (WPF/XAML, ASP.NET Core, servicios hospedados, clases de prueba, `Main`) ya no aparecen en «Unused candidates»; la lista indica cuántos se ocultaron y por qué. Las excepciones propias van en `ignoreUnused` del archivo de reglas; una casilla las desactiva.
- Añadido: los espacios de nombres se pueden desactivar uno a uno (lista «Namespaces» en el panel lateral, con un campo para reducirla).
- Añadido: «all / none» en el título de cada lista de filtros (relaciones, tipos, idiomas, proyectos, espacios de nombres).

### 1.0.0 – 2026-11-07

- Primera versión estable. Incluye todo lo de las versiones 0.x: el mapa con relaciones, marcos de espacios de nombres, contracción, análisis, reglas de arquitectura, miembros, exportación y la comparación con Git.
- Añadido: las reglas de arquitectura se explican en detalle en el README (primeros pasos, formato del archivo, patrones, qué cuenta como infracción, consejos), en cinco idiomas.
- Añadido: «Focus in map» en el panel de detalles centra el mapa en el tipo o grupo seleccionado.
- Cambiado: los mapas grandes cargan y reaccionan mucho más rápido. A partir de 80 tipos, o con tipos muy conectados, un diseño por capas más rápido sustituye a dagre; los mapas grandes se dibujan con líneas rectas. 1000 tipos con 5000 relaciones cargan en unos 3 segundos.

### 0.6.0 – 2026-11-07

- Añadido: comparar el mapa abierto con un commit, una rama o una etiqueta de Git («Compare with Git…» en la barra de herramientas, también como comando). Los tipos y dependencias nuevos se marcan en verde, los eliminados se dibujan de nuevo como «fantasmas» rojos discontinuos y el panel lateral enumera los cambios. La versión se analiza en una copia temporal; tu directorio de trabajo no se toca.

### 0.5.0 – 2026-11-07

- Añadido: exportación del mapa tal como se muestra (con filtros, grupos contraídos y marcos de espacios de nombres): PNG, SVG, Mermaid, Graphviz DOT y JSON («Export…» en la barra de herramientas).
- Añadido: tres relaciones nuevas, cada una con su propia entrada en el filtro: `registers` (registros de inyección de dependencias como `AddScoped<IOrders, Orders>()`, `AddHostedService<T>()`, también las sobrecargas con `typeof`), `events` (suscribirse, anular la suscripción y disparar eventos; antes contaban como accesos a propiedades) y `annotated` (atributos; antes contaban como simple uso).
- Añadido: pruebas del analizador (xUnit, espacio de trabajo en memoria) y un flujo de trabajo de GitHub Actions que compila y prueba el analizador y la extensión.
- Corregido: con los marcos de espacios de nombres activados, dos tipos de un mismo marco podían dibujarse uno encima del otro.

### 0.4.0 – 2026-11-07

- Añadido: análisis en la barra lateral: ciclos de dependencia entre tipos, espacios de nombres y proyectos (en rojo), ranking de puntos clave, candidatos a tipos sin uso y altura del nodo según acoplamiento, uso o tamaño.
- Añadido: reglas de arquitectura en `.atlas.json` (capas, `cannotUse`, `canOnlyUse`); las infracciones se dibujan en rojo y se enumeran. Ajuste `dotnetAtlas.rulesFile`.
- Añadido: contraer espacios de nombres o proyectos en un nodo (barra de herramientas); un doble clic abre un grupo.
- Añadido: miembros de un tipo con lo que cada uno llama, usa o a lo que accede, en el panel de detalles. El analizador los escribe como `memberDetails`.
- Añadido: marcos de espacios de nombres en el mapa (opción de la barra de herramientas: Off, Grouped, Nested); en modo anidado un espacio de nombres queda dentro del marco de su espacio padre. Valor inicial: el ajuste `dotnetAtlas.namespaceGrouping`.
- Cambiado: el mapa se abre en el grupo de editores activo en lugar de al lado; el código abierto desde el mapa aparece junto al mapa.

### 0.3.0 – 2026-11-07

- Añadido: icono del proyecto (un mapa plegado con costa) para la extensión y, en versión monocroma, para la barra de actividad.
- Añadido: una entrada en la barra de actividad (barra lateral izquierda) con una vista que abre el mapa de la solución o el mapa de ejemplo.
- Cambiado: el analizador incluido es más pequeño (solo recursos en inglés, sin símbolos de depuración).
- Añadido: este registro de cambios en cinco idiomas.

### 0.2.0 – 2026-11-06

- Añadido: compatibilidad con Visual Basic, incluidas las soluciones que mezclan C# y Visual Basic; nuevo filtro «Languages» (solo visible en soluciones mixtas).
- Cambiado: README en cinco idiomas; el proyecto se publica bajo la licencia MIT.

### 0.1.0 – 2026-11-06

- Primera versión: analizador basado en Roslyn para soluciones y proyectos C#, mapa interactivo en un panel de VS Code, mapa de ejemplo.
- Relaciones `inherits`, `implements`, `uses`, `calls` y `accesses` (llamadas a métodos, accesos a propiedades y campos, también a clases estáticas), cada una activable en el filtro.
- Los delegados como tipo propio; se tienen en cuenta las restricciones genéricas y las instrucciones de nivel superior.
- Grupos y particiones aisladas, modo de enfoque, búsqueda y panel de detalles.
- El ajuste `dotnetAtlas.zoomSpeed` para la velocidad del zoom con la rueda del ratón.
- El analizador funciona con SDK de .NET más nuevos que su runtime de destino (roll forward) e informa con claridad cuando falta el SDK.
