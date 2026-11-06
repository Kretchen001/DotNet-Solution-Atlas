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
        var symbols = new Dictionary<string, (INamedTypeSymbol Symbol, string Project)>(StringComparer.Ordinal);

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
                symbols.TryAdd(SymbolIds.For(type), (type, projectName));
            }
        }

        var nodes = symbols
            .Select(entry => CreateNode(entry.Key, entry.Value.Symbol, entry.Value.Project, ct))
            .OrderBy(node => node.Id, StringComparer.Ordinal)
            .ToList();

        Console.Error.WriteLine($"Found {nodes.Count} type(s).");

        return new AtlasGraph(root, nodes, []);
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
            Lines: lines);
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
            _ => NodeKind.Class,
        };
}
