using Atlas.Analyzer.Model;
using Microsoft.CodeAnalysis;

namespace Atlas.Analyzer.Analysis;

/// <summary>Turns the projects of a loaded workspace into an <see cref="AtlasGraph"/>.</summary>
internal static class GraphBuilder
{
    public static async Task<AtlasGraph> BuildAsync(
        string root,
        IReadOnlyList<Project> projects,
        CancellationToken ct = default)
    {
        var symbols = new Dictionary<string, (INamedTypeSymbol Symbol, string Project, Compilation Compilation)>(StringComparer.Ordinal);

        // A project that targets several frameworks is loaded once per target.
        // One of them is enough to describe its types.
        foreach (var project in projects.DistinctBy(p => p.FilePath))
        {
            var compilation = await project.GetCompilationAsync(ct);
            if (compilation is null)
            {
                Console.Error.WriteLine($"Skipping {project.Name}: no compilation available.");
                continue;
            }

            var projectName = ProjectName(project);

            foreach (var type in TypeWalker.GetTypes(compilation.Assembly.GlobalNamespace))
            {
                // Partial types and same-named types in several projects: first one wins.
                symbols.TryAdd(SymbolIds.For(type), (type, projectName, compilation));
            }
        }

        var nodes = symbols
            .Select(entry => CreateNode(entry.Key, entry.Value.Symbol, entry.Value.Project, ct))
            .OrderBy(node => node.Id, StringComparer.Ordinal)
            .ToList();

        var edges = CreateEdges(symbols, nodes, ct);

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
        List<AtlasNode> nodes,
        CancellationToken ct)
    {
        var known = nodes.Select(n => n.Id).ToHashSet(StringComparer.Ordinal);
        var weights = new Dictionary<(string Source, string Target, EdgeKind Kind), int>();

        foreach (var (id, entry) in symbols)
        {
            var dependencies = DependencyCollector.Collect(entry.Symbol)
                .Concat(BodyDependencyCollector.Collect(entry.Symbol, entry.Compilation, ct));

            foreach (var (target, kind) in dependencies)
            {
                if (target == id || !known.Contains(target))
                {
                    continue;
                }

                var key = (id, target, kind);
                weights[key] = weights.GetValueOrDefault(key) + 1;
            }
        }

        return weights
            .Select(w => new AtlasEdge(w.Key.Source, w.Key.Target, w.Key.Kind, w.Value))
            .OrderBy(e => e.Source, StringComparer.Ordinal)
            .ThenBy(e => e.Target, StringComparer.Ordinal)
            .ThenBy(e => e.Kind)
            .ToList();
    }

    /// <summary>Project name without the target framework suffix, e.g. <c>Shop.Api</c> instead of <c>Shop.Api(net8.0)</c>.</summary>
    private static string ProjectName(Project project) =>
        project.FilePath is { } path ? Path.GetFileNameWithoutExtension(path) : project.Name;

    private static AtlasNode CreateNode(string id, INamedTypeSymbol type, string project, CancellationToken ct)
    {
        var location = type.Locations.First(l => l.IsInSource).GetLineSpan();

        var members = type.GetMembers().Where(m => !m.IsImplicitlyDeclared).ToList();
        var methods = members.OfType<IMethodSymbol>().Count(m => m.MethodKind == MethodKind.Ordinary);

        var lines = type.DeclaringSyntaxReferences.Sum(reference =>
        {
            var span = reference.GetSyntax(ct).GetLocation().GetLineSpan();
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
            IsStatic: type.IsStatic);
    }

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
            _ => NodeKind.Class,
        };
}
