using System.Xml.Linq;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.VisualBasic;

namespace Atlas.Analyzer.Analysis;

/// <summary>
/// A way around projects that MSBuild cannot load (COM references with the .NET SDK's MSBuild, old-style
/// projects whose build host fails, missing workloads). The source files are read from disk and compiled
/// without the references of the project: types of the framework and of packages are unknown then, but the
/// relationships between the types of the solution are found, which is all the map shows. Base types of
/// the framework are missing, so the exceptions for unused types that depend on them do not apply.
/// </summary>
internal static class SourceFallback
{
    private static readonly HashSet<string> SkippedDirectories = new(StringComparer.OrdinalIgnoreCase)
    {
        "bin", "obj", "node_modules", "packages",
    };

    // The runtime that runs the analyzer is the reference of the code. Reference assemblies of the project are not known.
    private static readonly Lazy<IReadOnlyList<MetadataReference>> Framework = new(() =>
        ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Where(path =>
            {
                var name = Path.GetFileName(path);
                return name.StartsWith("System.", StringComparison.Ordinal)
                    || name.StartsWith("Microsoft.VisualBasic", StringComparison.Ordinal)
                    || name is "netstandard.dll" or "mscorlib.dll";
            })
            .Select(path => (MetadataReference)MetadataReference.CreateFromFile(path))
            .ToList());

    /// <summary>
    /// Adds what MSBuild did not deliver: the source files of projects that were loaded without any document,
    /// and whole projects that could not be loaded at all.
    /// </summary>
    public static Solution Complete(Solution solution, IReadOnlyList<string> projectPaths)
    {
        var loaded = new Dictionary<string, List<Project>>(StringComparer.OrdinalIgnoreCase);
        foreach (var project in solution.Projects.Where(p => p.FilePath is not null))
        {
            var key = Path.GetFullPath(project.FilePath!);
            if (!loaded.TryGetValue(key, out var list))
            {
                loaded[key] = list = [];
            }

            list.Add(project);
        }

        var created = new Dictionary<string, ProjectId>(StringComparer.OrdinalIgnoreCase);

        foreach (var projectPath in projectPaths)
        {
            var path = Path.GetFullPath(projectPath);

            if (loaded.TryGetValue(path, out var existing))
            {
                foreach (var project in existing.Where(p => !p.Documents.Any()))
                {
                    var files = SourceFiles(path, project.Language);
                    if (files.Count == 0)
                    {
                        continue;
                    }

                    Console.Error.WriteLine($"[Fallback] {project.Name}: MSBuild delivered no source files, reading {files.Count} file(s) from disk.");
                    foreach (var file in files)
                    {
                        solution = solution.AddDocument(Document(project.Id, file));
                    }
                }

                continue;
            }

            var info = CreateProject(path);
            if (info is null)
            {
                continue;
            }

            Console.Error.WriteLine($"[Fallback] {info.Name}: MSBuild could not load the project, reading {info.Documents.Count} source file(s) from disk.");
            solution = solution.AddProject(info);
            created[path] = info.Id;
        }

        return created.Count == 0 ? solution : AddReferences(solution, created);
    }

    /// <summary>Project references of the project files, for the projects that were created here (MSBuild dropped them).</summary>
    private static Solution AddReferences(Solution solution, Dictionary<string, ProjectId> created)
    {
        var idByPath = new Dictionary<string, ProjectId>(created, StringComparer.OrdinalIgnoreCase);
        foreach (var project in solution.Projects.Where(p => p.FilePath is not null))
        {
            idByPath.TryAdd(Path.GetFullPath(project.FilePath!), project.Id);
        }

        foreach (var project in solution.Projects.Where(p => p.FilePath is not null).ToList())
        {
            var directory = Path.GetDirectoryName(Path.GetFullPath(project.FilePath!))!;
            foreach (var include in ProjectReferences(Load(project.FilePath!)))
            {
                if (!idByPath.TryGetValue(FullPath(directory, include), out var target)
                    || target == project.Id
                    || !created.ContainsValue(target)
                    || solution.GetProject(project.Id)!.ProjectReferences.Any(r => r.ProjectId == target))
                {
                    continue;
                }

                try
                {
                    solution = solution.AddProjectReference(project.Id, new ProjectReference(target));
                }
                catch (InvalidOperationException)
                {
                    // A cycle or a reference that is not possible: the relationship is missing, the rest still works.
                }
            }
        }

        return solution;
    }

    private static ProjectInfo? CreateProject(string path)
    {
        var language = path.EndsWith(".vbproj", StringComparison.OrdinalIgnoreCase) ? LanguageNames.VisualBasic : LanguageNames.CSharp;
        var files = SourceFiles(path, language);
        if (files.Count == 0)
        {
            return null;
        }

        var document = Load(path);
        var name = Path.GetFileNameWithoutExtension(path);
        var id = ProjectId.CreateNewId(name);

        var kind = Property(document, "OutputType") switch
        {
            "Exe" => OutputKind.ConsoleApplication,
            "WinExe" => OutputKind.WindowsApplication,
            _ => OutputKind.DynamicallyLinkedLibrary,
        };

        CompilationOptions options;
        ParseOptions parse;
        if (language == LanguageNames.VisualBasic)
        {
            options = new VisualBasicCompilationOptions(kind).WithRootNamespace(Property(document, "RootNamespace") ?? name);
            parse = new VisualBasicParseOptions(Microsoft.CodeAnalysis.VisualBasic.LanguageVersion.Latest);
        }
        else
        {
            options = new CSharpCompilationOptions(kind);
            parse = new CSharpParseOptions(Microsoft.CodeAnalysis.CSharp.LanguageVersion.Latest);
        }

        return ProjectInfo.Create(
            id,
            VersionStamp.Create(),
            name,
            Property(document, "AssemblyName") ?? name,
            language,
            filePath: path,
            compilationOptions: options,
            parseOptions: parse,
            documents: files.Select(file => Document(id, file)).ToList(),
            metadataReferences: Framework.Value);
    }

    private static DocumentInfo Document(ProjectId project, string file) =>
        DocumentInfo.Create(
            DocumentId.CreateNewId(project),
            Path.GetFileName(file),
            filePath: file,
            loader: new FileTextLoader(file, null));

    /// <summary>
    /// The source files of a project: the listed <c>Compile</c> items of an old-style project, otherwise
    /// every file of the language below the project directory (what an SDK-style project does by default).
    /// </summary>
    internal static List<string> SourceFiles(string projectPath, string language)
    {
        var extension = language == LanguageNames.VisualBasic ? ".vb" : ".cs";
        var directory = Path.GetDirectoryName(Path.GetFullPath(projectPath))!;
        var document = Load(projectPath);

        if (document is not null && !IsSdkStyle(document))
        {
            var listed = document.Descendants()
                .Where(e => e.Name.LocalName == "Compile")
                .Select(e => e.Attribute("Include")?.Value)
                .OfType<string>()
                .Select(include => FullPath(directory, include))
                .Where(File.Exists)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (listed.Count > 0)
            {
                return listed;
            }
        }

        var result = new List<string>();
        var pending = new Stack<string>();
        pending.Push(directory);

        while (pending.Count > 0)
        {
            var current = pending.Pop();
            try
            {
                foreach (var sub in Directory.EnumerateDirectories(current))
                {
                    var name = Path.GetFileName(sub);
                    if (SkippedDirectories.Contains(name) || name.StartsWith('.') || HasProjectFile(sub))
                    {
                        continue; // build output, hidden folders and the folders of other projects
                    }

                    pending.Push(sub);
                }

                result.AddRange(Directory.EnumerateFiles(current).Where(f => string.Equals(Path.GetExtension(f), extension, StringComparison.OrdinalIgnoreCase)));
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                Console.Error.WriteLine($"Skipping {current}: {ex.Message}");
            }
        }

        result.Sort(StringComparer.OrdinalIgnoreCase);
        return result;
    }

    private static bool HasProjectFile(string directory)
    {
        try
        {
            return Directory.EnumerateFiles(directory).Any(f =>
                f.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase) || f.EndsWith(".vbproj", StringComparison.OrdinalIgnoreCase));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    private static XDocument? Load(string path)
    {
        try
        {
            return XDocument.Load(path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Xml.XmlException)
        {
            return null;
        }
    }

    private static bool IsSdkStyle(XDocument document) =>
        document.Root?.Attribute("Sdk") is not null
        || document.Descendants().Any(e => e.Name.LocalName is "Sdk" || (e.Name.LocalName == "Import" && e.Attribute("Sdk") is not null));

    private static string? Property(XDocument? document, string name) =>
        document?.Descendants()
            .Where(e => e.Name.LocalName == name)
            .Select(e => e.Value.Trim())
            .FirstOrDefault(value => value.Length > 0);

    private static IEnumerable<string> ProjectReferences(XDocument? document) =>
        document?.Descendants()
            .Where(e => e.Name.LocalName == "ProjectReference")
            .Select(e => e.Attribute("Include")?.Value)
            .OfType<string>()
        ?? [];

    private static string FullPath(string directory, string relative) =>
        Path.GetFullPath(Path.Combine(directory, relative.Replace('\\', Path.DirectorySeparatorChar)));
}
