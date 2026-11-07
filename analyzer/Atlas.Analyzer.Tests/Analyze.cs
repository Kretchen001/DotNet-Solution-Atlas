using Atlas.Analyzer.Analysis;
using Atlas.Analyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Text;
using Microsoft.CodeAnalysis.VisualBasic;

namespace Atlas.Analyzer.Tests;

/// <summary>A project of a test solution: its source and the projects it references.</summary>
internal sealed class TestProject
{
    public required string Name { get; init; }

    public required string Language { get; init; }

    public required string Source { get; init; }

    public string[] References { get; init; } = [];

    /// <summary>Needed for top-level statements.</summary>
    public bool Executable { get; init; }
}

/// <summary>Builds the graph for sources given as text, without MSBuild and without files on disk.</summary>
internal static class Analyze
{
    // The runtime the tests run on is also the reference of the analyzed code.
    private static readonly Lazy<IReadOnlyList<MetadataReference>> Framework = new(() =>
        ((string)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES")!)
            .Split(Path.PathSeparator)
            .Where(path =>
            {
                var name = Path.GetFileName(path);
                return name.StartsWith("System.", StringComparison.Ordinal)
                    || name.StartsWith("Microsoft.VisualBasic", StringComparison.Ordinal)
                    || name is "netstandard.dll" or "mscorlib.dll";
            })
            .Select(path => (MetadataReference)MetadataReference.CreateFromFile(path))
            .ToList());

    public static TestProject CSharp(string name, string source, params string[] references) =>
        new() { Name = name, Language = LanguageNames.CSharp, Source = source, References = references };

    public static TestProject VisualBasic(string name, string source, params string[] references) =>
        new() { Name = name, Language = LanguageNames.VisualBasic, Source = source, References = references };

    public static async Task<AtlasGraph> BuildAsync(params TestProject[] projects)
    {
        using var workspace = new AdhocWorkspace();
        var ids = new Dictionary<string, ProjectId>();

        foreach (var project in projects)
        {
            var id = ProjectId.CreateNewId(project.Name);
            ids[project.Name] = id;

            var kind = project.Executable ? OutputKind.ConsoleApplication : OutputKind.DynamicallyLinkedLibrary;
            CompilationOptions options = project.Language == LanguageNames.CSharp
                ? new CSharpCompilationOptions(kind)
                : new VisualBasicCompilationOptions(kind);

            var info = ProjectInfo.Create(
                id,
                VersionStamp.Create(),
                project.Name,
                project.Name,
                project.Language,
                compilationOptions: options,
                metadataReferences: Framework.Value,
                projectReferences: project.References.Select(name => new ProjectReference(ids[name])));

            var added = workspace.AddProject(info);
            var extension = project.Language == LanguageNames.CSharp ? "cs" : "vb";
            workspace.AddDocument(added.Id, $"{project.Name}.{extension}", SourceText.From(project.Source));
        }

        return await GraphBuilder.BuildAsync("test.sln", workspace.CurrentSolution.Projects.ToList());
    }

    public static AtlasEdge? Edge(this AtlasGraph graph, string source, string target, EdgeKind kind) =>
        graph.Edges.FirstOrDefault(e => e.Source == source && e.Target == target && e.Kind == kind);

    public static AtlasNode Node(this AtlasGraph graph, string id) =>
        graph.Nodes.Single(n => n.Id == id);
}
