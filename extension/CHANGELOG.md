# Changelog

<!-- Maintainers: keep all five languages in sync, same order as in the README. -->

**English** · [Deutsch](#deutsch) · [中文](#中文) · [Русский](#русский) · [Español](#español)

All notable changes to **DotNet Solution Atlas** are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/).

---

## English

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
