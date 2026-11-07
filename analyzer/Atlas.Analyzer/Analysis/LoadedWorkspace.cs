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
        var workspace = CreateWorkspace();
        var isSolution = SolutionExtensions.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase);
        IReadOnlyList<string> projectPaths = isSolution ? SolutionFiles.ProjectPaths(path) : new[] { Path.GetFullPath(path) };

        try
        {
            Solution solution;

            try
            {
                solution = isSolution
                    ? await workspace.OpenSolutionAsync(path, cancellationToken: ct)
                    : (await workspace.OpenProjectAsync(path, cancellationToken: ct)).Solution;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // E.g. the build host for .NET Framework projects crashes with a TypeLoadException when it
                // runs with a newer Visual Studio. One such project must not cost the whole map.
                Console.Error.WriteLine($"Opening {Path.GetFileName(path)} as a whole failed: {FirstLine(ex.Message)}");
                Console.Error.WriteLine("Loading the projects one by one instead ...");

                workspace.Dispose();
                workspace = CreateWorkspace();

                foreach (var projectPath in projectPaths)
                {
                    try
                    {
                        await workspace.OpenProjectAsync(projectPath, cancellationToken: ct);
                    }
                    catch (Exception inner) when (inner is not OperationCanceledException)
                    {
                        Console.Error.WriteLine($"[Skipped] {projectPath}: {FirstLine(inner.Message)}");
                    }
                }

                solution = workspace.CurrentSolution;
            }

            // Projects that MSBuild could not deliver (or delivered without source files) are read from disk.
            solution = SourceFallback.Complete(solution, projectPaths);

            return new LoadedWorkspace(workspace, solution.Projects.ToList());
        }
        catch
        {
            workspace.Dispose();
            throw;
        }
    }

    private static MSBuildWorkspace CreateWorkspace()
    {
        var workspace = MSBuildWorkspace.Create();

        // Loading problems (missing workloads, unresolved references, ...) are
        // reported but do not stop the analysis: a partial map is still useful.
        workspace.WorkspaceFailed += (_, e) =>
            Console.Error.WriteLine($"[{e.Diagnostic.Kind}] {e.Diagnostic.Message}");

        return workspace;
    }

    private static string FirstLine(string message) => message.ReplaceLineEndings("\n").Split('\n')[0];

    public void Dispose() => _workspace.Dispose();
}
