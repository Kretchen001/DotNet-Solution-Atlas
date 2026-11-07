# Changelog

<!-- Maintainers: keep all five languages in sync, same order as in the README. -->

**English** · [Deutsch](#deutsch) · [中文](#中文) · [Русский](#русский) · [Español](#español)

All notable changes to **DotNet Solution Atlas** are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/).

---

## English

### Unreleased

- Added: "Group by namespace" switch in the map toolbar; draws a frame around the types of each namespace.

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

### Unveröffentlicht

- Neu: Schalter „Group by namespace“ in der Werkzeugleiste der Karte; zeichnet einen Rahmen um die Typen jedes Namespace.

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

### 未发布

- 新增：地图工具栏中的“Group by namespace”开关；在每个命名空间的类型周围绘制边框。

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

### Не выпущено

- Добавлено: переключатель «Group by namespace» на панели инструментов карты; рисует рамку вокруг типов каждого пространства имён.

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

### Sin publicar

- Añadido: interruptor «Group by namespace» en la barra de herramientas del mapa; dibuja un marco alrededor de los tipos de cada espacio de nombres.

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
