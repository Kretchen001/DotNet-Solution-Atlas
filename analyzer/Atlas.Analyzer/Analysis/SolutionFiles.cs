using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Atlas.Analyzer.Analysis;

/// <summary>
/// The project files a solution file lists, read without MSBuild. Used when MSBuild cannot open the
/// solution as a whole, so that the projects can be tried one by one.
/// </summary>
internal static class SolutionFiles
{
    private static readonly string[] ProjectExtensions = [".csproj", ".vbproj"];

    // Project("{type guid}") = "Name", "relative\path.csproj", "{guid}"
    private static readonly Regex SlnProject = new(
        @"^Project\(""\{[^}]+\}""\)\s*=\s*""[^""]*""\s*,\s*""([^""]+)""\s*,",
        RegexOptions.Multiline | RegexOptions.Compiled);

    /// <summary>Full paths of the existing C# and Visual Basic projects of a .sln, .slnx or .slnf file.</summary>
    public static IReadOnlyList<string> ProjectPaths(string solutionPath)
    {
        try
        {
            var full = Path.GetFullPath(solutionPath);
            var directory = Path.GetDirectoryName(full)!;
            var text = File.ReadAllText(full);

            return Path.GetExtension(full).ToLowerInvariant() switch
            {
                ".slnx" => Resolve(directory, XDocument.Parse(text).Descendants()
                    .Where(e => e.Name.LocalName == "Project")
                    .Select(e => e.Attribute("Path")?.Value)),
                ".slnf" => FromFilter(directory, text),
                _ => Resolve(directory, SlnProject.Matches(text).Select(m => (string?)m.Groups[1].Value)),
            };
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or System.Xml.XmlException)
        {
            Console.Error.WriteLine($"Could not read the project list of {solutionPath}: {ex.Message}");
            return [];
        }
    }

    // { "solution": { "path": "All.sln", "projects": [ "src\\A\\A.csproj" ] } }; the paths are relative to the .sln.
    private static IReadOnlyList<string> FromFilter(string directory, string text)
    {
        using var document = JsonDocument.Parse(text);
        var solution = document.RootElement.GetProperty("solution");
        var solutionDirectory = Path.GetDirectoryName(Path.GetFullPath(Path.Combine(directory, Normalize(solution.GetProperty("path").GetString() ?? ""))))!;
        var projects = solution.GetProperty("projects").EnumerateArray().Select(p => p.GetString());
        return Resolve(solutionDirectory, projects);
    }

    private static List<string> Resolve(string directory, IEnumerable<string?> relativePaths) =>
        relativePaths
            .OfType<string>()
            .Where(p => ProjectExtensions.Contains(Path.GetExtension(p), StringComparer.OrdinalIgnoreCase))
            .Select(p => Path.GetFullPath(Path.Combine(directory, Normalize(p))))
            .Where(File.Exists)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static string Normalize(string path) => path.Replace('\\', Path.DirectorySeparatorChar).Replace('/', Path.DirectorySeparatorChar);
}
