using Atlas.Analyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Atlas.Analyzer.Analysis;

/// <summary>Turns the projects of a loaded workspace into an <see cref="AtlasGraph"/>.</summary>
internal static class GraphBuilder
{
    public static async Task<AtlasGraph> BuildAsync(
        string root,
        IReadOnlyList<Project> projects,
        bool readXaml = true,
        CancellationToken ct = default)
    {
        var symbols = new Dictionary<string, (INamedTypeSymbol Symbol, string Project, Compilation Compilation)>(StringComparer.Ordinal);
        var topLevel = new Dictionary<string, (AtlasNode Node, Compilation Compilation, IReadOnlyList<GlobalStatementSyntax> Statements)>(StringComparer.Ordinal);

        // A project that targets several frameworks is loaded once per target.
        // One of them is enough to describe its types.
        foreach (var project in projects.DistinctBy(p => p.FilePath ?? p.Id.ToString()))
        {
            var compilation = await project.GetCompilationAsync(ct);
            if (compilation is null)
            {
                Console.Error.WriteLine($"Skipping {project.Name}: no compilation available.");
                continue;
            }

            var projectName = ProjectName(project);

            foreach (var type in TypeWalker.GetTypes(compilation))
            {
                // Partial types and same-named types in several projects: first one wins.
                symbols.TryAdd(SymbolIds.For(type), (type, projectName, compilation));
            }

            // Code in top-level statements (Program.cs without a class) belongs to no declared
            // type, yet it is often where everything is wired up. It becomes a node of its own.
            foreach (var tree in compilation.SyntaxTrees.Where(_ => compilation.Language == LanguageNames.CSharp))
            {
                var unit = await tree.GetRootAsync(ct);
                var statements = unit.ChildNodes().OfType<GlobalStatementSyntax>().ToList();

                if (statements.Count > 0)
                {
                    var id = $"{projectName}.<top-level statements>";
                    topLevel.TryAdd(id, (CreateTopLevelNode(id, projectName, statements), compilation, statements));
                }
            }
        }

        var nodes = symbols
            .Select(entry => CreateNode(entry.Key, entry.Value.Symbol, entry.Value.Project, entry.Value.Compilation, ct))
            .Concat(topLevel.Values.Select(entry => entry.Node))
            .OrderBy(node => node.Id, StringComparer.Ordinal)
            .ToList();

        // Needs all ids: references to types outside the solution are left out of the member lists.
        var known = nodes.Select(node => node.Id).ToHashSet(StringComparer.Ordinal);
        nodes = nodes
            .Select(node => symbols.TryGetValue(node.Id, out var entry)
                ? node with { MemberDetails = MemberAnalyzer.Collect(entry.Symbol, entry.Compilation, known, ct) }
                : node)
            .ToList();

        var xaml = readXaml ? CollectXaml(projects, known) : new List<(string Source, string Target)>();
        var edges = CreateEdges(symbols, topLevel, nodes, xaml, ct);

        Console.Error.WriteLine($"Found {nodes.Count} type(s) and {edges.Count} relationship(s).");

        return new AtlasGraph(root, nodes, edges);
    }

    /// <summary>
    /// Counts every occurrence of a relationship and keeps one edge per
    /// (source, target, kind). References to types outside the solution
    /// (framework, NuGet packages) and self references are dropped.
    /// </summary>
    private static List<AtlasEdge> CreateEdges(
        Dictionary<string, (INamedTypeSymbol Symbol, string Project, Compilation Compilation)> symbols,
        Dictionary<string, (AtlasNode Node, Compilation Compilation, IReadOnlyList<GlobalStatementSyntax> Statements)> topLevel,
        List<AtlasNode> nodes,
        IReadOnlyList<(string Source, string Target)> xaml,
        CancellationToken ct)
    {
        var known = nodes.Select(n => n.Id).ToHashSet(StringComparer.Ordinal);
        var weights = new Dictionary<(string Source, string Target, EdgeKind Kind), int>();

        void Add(string source, IEnumerable<(string Target, EdgeKind Kind)> dependencies)
        {
            foreach (var (target, kind) in dependencies)
            {
                if (target == source || !known.Contains(target))
                {
                    continue;
                }

                var key = (source, target, kind);
                weights[key] = weights.GetValueOrDefault(key) + 1;
            }
        }

        foreach (var (id, entry) in symbols)
        {
            Add(id, DependencyCollector.Collect(entry.Symbol)
                .Concat(BodyDependencyCollector.Collect(entry.Symbol, entry.Compilation, ct)));
        }

        foreach (var (id, entry) in topLevel)
        {
            Add(id, BodyDependencyCollector.CollectTopLevel(entry.Statements, entry.Compilation, ct));
        }

        foreach (var (source, target) in xaml)
        {
            Add(source, [(target, EdgeKind.Xaml)]);
        }

        return weights
            .Select(w => new AtlasEdge(w.Key.Source, w.Key.Target, w.Key.Kind, w.Value))
            .OrderBy(e => e.Source, StringComparer.Ordinal)
            .ThenBy(e => e.Target, StringComparer.Ordinal)
            .ThenBy(e => e.Kind)
            .ToList();
    }

    /// <summary>
    /// The references that XAML files make to types, found by reading the .xaml / .axaml files below the
    /// directory of every project. Roslyn does not see them: the files are no part of the compilation.
    /// </summary>
    private static List<(string Source, string Target)> CollectXaml(IReadOnlyList<Project> projects, ISet<string> known)
    {
        var directories = projects
            .Select(p => p.FilePath)
            .OfType<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(path => XamlReferences.Normalize(Path.GetDirectoryName(path)!))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var result = new List<(string, string)>();
        var count = 0;

        foreach (var directory in directories.Where(Directory.Exists))
        {
            var others = directories.Where(d => !string.Equals(d, directory, StringComparison.OrdinalIgnoreCase)).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var files = XamlReferences.Load(directory, others);
            count += files.Count;
            result.AddRange(XamlReferences.Resolve(files, directory, known));
        }

        if (count > 0)
        {
            Console.Error.WriteLine($"Read {count} XAML file(s).");
        }

        return result;
    }

    /// <summary>Project name without the target framework suffix, e.g. <c>Shop.Api</c> instead of <c>Shop.Api(net8.0)</c>.</summary>
    private static string ProjectName(Project project) =>
        project.FilePath is { } path ? Path.GetFileNameWithoutExtension(path) : project.Name;

    private static AtlasNode CreateTopLevelNode(string id, string project, IReadOnlyList<GlobalStatementSyntax> statements)
    {
        var first = statements[0].GetLocation().GetLineSpan();
        var last = statements[^1].GetLocation().GetLineSpan();

        return new AtlasNode(
            Id: id,
            Name: "Program (top-level statements)",
            Kind: NodeKind.Class,
            Namespace: "",
            Project: project,
            File: first.Path,
            Line: first.StartLinePosition.Line + 1,
            Members: 0,
            Methods: 0,
            Lines: last.EndLinePosition.Line - first.StartLinePosition.Line + 1,
            IsStatic: true,
            Language: "csharp");
    }

    private static AtlasNode CreateNode(
        string id,
        INamedTypeSymbol type,
        string project,
        Compilation compilation,
        CancellationToken ct)
    {
        var location = type.Locations.First(l => l.IsInSource).GetLineSpan();

        var members = type.GetMembers().Where(m => !m.IsImplicitlyDeclared).ToList();
        var methods = members.OfType<IMethodSymbol>().Count(m => m.MethodKind == MethodKind.Ordinary);

        var support = SyntaxSupport.For(compilation.Language);

        var lines = type.DeclaringSyntaxReferences.Sum(reference =>
        {
            // In Visual Basic the declaration is only the header line, the body is the block around it.
            var declaration = reference.GetSyntax(ct);
            var span = (support?.BodyRoot(declaration) ?? declaration).GetLocation().GetLineSpan();
            return span.EndLinePosition.Line - span.StartLinePosition.Line + 1;
        });

        return new AtlasNode(
            Id: id,
            Name: DisplayName(type),
            Kind: KindOf(type),
            Namespace: type.ContainingNamespace.IsGlobalNamespace ? "" : type.ContainingNamespace.ToDisplayString(),
            Project: project,
            File: location.Path,
            Line: location.StartLinePosition.Line + 1,
            Members: members.Count,
            Methods: methods,
            Lines: lines,
            IsStatic: type.IsStatic || type.TypeKind == TypeKind.Module,
            Language: LanguageId(compilation),
            BaseTypes: OrNull(InheritedNames(type)),
            Attributes: OrNull(AttributeNames(type)));
    }

    private static IReadOnlyList<string>? OrNull(List<string> names) => names.Count == 0 ? null : names;

    /// <summary>Namespace-qualified names without type arguments: <c>System.Collections.Generic.IEnumerable</c>.</summary>
    private static readonly SymbolDisplayFormat QualifiedName = new(
        typeQualificationStyle: SymbolDisplayTypeQualificationStyle.NameAndContainingTypesAndNamespaces,
        genericsOptions: SymbolDisplayGenericsOptions.None);

    /// <summary>All base classes (except object) and all interfaces, direct and inherited, sorted.</summary>
    private static List<string> InheritedNames(INamedTypeSymbol type)
    {
        var names = new HashSet<string>(StringComparer.Ordinal);

        for (var baseType = type.BaseType; baseType is not null; baseType = baseType.BaseType)
        {
            if (baseType.SpecialType is not (SpecialType.System_Object or SpecialType.System_ValueType or SpecialType.System_Enum))
            {
                names.Add(baseType.OriginalDefinition.ToDisplayString(QualifiedName));
            }
        }

        foreach (var implemented in type.AllInterfaces)
        {
            names.Add(implemented.OriginalDefinition.ToDisplayString(QualifiedName));
        }

        return [.. names.Order(StringComparer.Ordinal)];
    }

    /// <summary>The attribute classes on the type and on its members (a test class has them on its methods).</summary>
    private static List<string> AttributeNames(INamedTypeSymbol type)
    {
        var names = new HashSet<string>(StringComparer.Ordinal);

        foreach (var symbol in type.GetMembers().Prepend<ISymbol>(type))
        {
            foreach (var attribute in symbol.GetAttributes())
            {
                if (attribute.AttributeClass is { } attributeClass)
                {
                    names.Add(attributeClass.ToDisplayString(QualifiedName));
                }
            }
        }

        return [.. names.Order(StringComparer.Ordinal)];
    }

    /// <summary>The language of a compilation as written in the JSON.</summary>
    private static string LanguageId(Compilation compilation) =>
        compilation.Language == LanguageNames.VisualBasic ? "visualbasic" : "csharp";

    private static string DisplayName(INamedTypeSymbol type) =>
        type.IsGenericType
            ? $"{type.Name}<{string.Join(", ", type.TypeParameters.Select(p => p.Name))}>"
            : type.Name;

    private static NodeKind KindOf(INamedTypeSymbol type) =>
        type.IsRecord ? NodeKind.Record
        : type.TypeKind switch
        {
            TypeKind.Interface => NodeKind.Interface,
            TypeKind.Struct => NodeKind.Struct,
            TypeKind.Enum => NodeKind.Enum,
            TypeKind.Delegate => NodeKind.Delegate,
            TypeKind.Module => NodeKind.Class,
            _ => NodeKind.Class,
        };
}
