using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.MSBuild;

namespace Atlas.Analyzer.Analysis;

/// <summary>
/// A solution or project opened with MSBuild. The workspace has to stay alive
/// as long as the projects are used, so it is owned by this object.
/// </summary>
internal sealed class LoadedWorkspace : IDisposable
{
    private static readonly string[] SolutionExtensions = [".sln", ".slnx", ".slnf"];

    private readonly MSBuildWorkspace _workspace;

    private LoadedWorkspace(MSBuildWorkspace workspace, IReadOnlyList<Project> projects)
    {
        _workspace = workspace;
        Projects = projects;
    }

    public IReadOnlyList<Project> Projects { get; }

    public static async Task<LoadedWorkspace> OpenAsync(string path, CancellationToken ct = default)
    {
        var workspace = MSBuildWorkspace.Create();

        // Loading problems (missing workloads, unresolved references, ...) are
        // reported but do not stop the analysis: a partial map is still useful.
        workspace.WorkspaceFailed += (_, e) =>
            Console.Error.WriteLine($"[{e.Diagnostic.Kind}] {e.Diagnostic.Message}");

        try
        {
            IReadOnlyList<Project> projects;

            if (SolutionExtensions.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase))
            {
                var solution = await workspace.OpenSolutionAsync(path, cancellationToken: ct);
                projects = solution.Projects.ToList();
            }
            else
            {
                var project = await workspace.OpenProjectAsync(path, cancellationToken: ct);
                projects = [project];
            }

            return new LoadedWorkspace(workspace, projects);
        }
        catch
        {
            workspace.Dispose();
            throw;
        }
    }

    public void Dispose() => _workspace.Dispose();
}
