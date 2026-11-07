using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace Atlas.Analyzer.Analysis;

/// <summary>
/// What one XAML file refers to.
/// </summary>
/// <param name="Path">Full path of the file.</param>
/// <param name="ClassName">The <c>x:Class</c> of the root element, i.e. the code-behind type; null for resource dictionaries.</param>
/// <param name="RootName">Local name of the root element (<c>Window</c>, <c>Application</c>, <c>ResourceDictionary</c>, ...).</param>
/// <param name="Types">Full names of the types the file names: elements, <c>{x:Type}</c>, <c>{x:Static}</c>, attached properties, ... One entry per occurrence.</param>
/// <param name="Files">Values that name another XAML file (<c>StartupUri</c>, <c>ResourceDictionary Source</c>).</param>
internal sealed record XamlFile(string Path, string? ClassName, string RootName, IReadOnlyList<string> Types, IReadOnlyList<string> Files);

/// <summary>
/// Reads XAML (WPF, WinUI, Avalonia, MAUI) for the types it refers to. Types that are only used in XAML
/// - converters, view models, user controls, windows that are started through <c>StartupUri</c> - have no
/// reference in the code and would look unused otherwise.
/// </summary>
internal static class XamlReferences
{
    private static readonly XNamespace XamlNamespace = "http://schemas.microsoft.com/winfx/2006/xaml";

    private static readonly string[] Extensions = [".xaml", ".axaml"];

    private static readonly HashSet<string> SkippedDirectories = new(StringComparer.OrdinalIgnoreCase)
    {
        "bin", "obj", "node_modules",
    };

    // A prefixed name inside an attribute value: local:Foo, local:Foo.Bar. Not "http://...".
    private static readonly Regex PrefixedName = new(@"(?<![\w.:/])([A-Za-z_]\w*):([A-Za-z_]\w*)", RegexOptions.Compiled);

    /// <summary>
    /// The XAML files of a project directory. Directories of other projects (nested projects) and the
    /// build output are skipped.
    /// </summary>
    public static IReadOnlyList<XamlFile> Load(string projectDirectory, ISet<string> otherProjectDirectories)
    {
        var result = new List<XamlFile>();
        var pending = new Stack<string>();
        pending.Push(projectDirectory);

        while (pending.Count > 0)
        {
            var directory = pending.Pop();

            try
            {
                foreach (var sub in Directory.EnumerateDirectories(directory))
                {
                    var name = Path.GetFileName(sub);
                    if (SkippedDirectories.Contains(name) || name.StartsWith('.') || otherProjectDirectories.Contains(Normalize(sub)))
                    {
                        continue;
                    }

                    pending.Push(sub);
                }

                foreach (var file in Directory.EnumerateFiles(directory))
                {
                    if (!Extensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    if (Parse(file, File.ReadAllText(file)) is { } xaml)
                    {
                        result.Add(xaml);
                    }
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                Console.Error.WriteLine($"Skipping {directory}: {ex.Message}");
            }
        }

        return result;
    }

    /// <summary>Reads one XAML document. Null if it is not well-formed XML.</summary>
    public static XamlFile? Parse(string path, string text)
    {
        XDocument document;
        try
        {
            document = XDocument.Parse(text);
        }
        catch (XmlException)
        {
            return null;
        }

        if (document.Root is not { } root)
        {
            return null;
        }

        var types = new List<string>();
        var files = new List<string>();

        foreach (var element in root.DescendantsAndSelf())
        {
            AddType(types, element.Name.NamespaceName, element.Name.LocalName, requireDot: false);

            foreach (var attribute in element.Attributes())
            {
                if (attribute.IsNamespaceDeclaration)
                {
                    continue;
                }

                // local:Grid.Row="1": an attached property of a type of the solution.
                AddType(types, attribute.Name.NamespaceName, attribute.Name.LocalName, requireDot: true);
                ScanValue(element, attribute.Value, types, files);
            }

            foreach (var node in element.Nodes().OfType<XText>())
            {
                if (node.Value.TrimStart().StartsWith('{'))
                {
                    ScanValue(element, node.Value, types, files: null);
                }
            }
        }

        return new XamlFile(path, root.Attribute(XamlNamespace + "Class")?.Value, root.Name.LocalName, types, files);
    }

    /// <summary>
    /// The pairs (source type, target type) that the files of one project form. The source is the
    /// code-behind type of the file; resource dictionaries have none and count for the application
    /// class of the project. Unknown types (framework, packages) are left out.
    /// </summary>
    public static IEnumerable<(string Source, string Target)> Resolve(
        IReadOnlyList<XamlFile> files,
        string projectDirectory,
        ISet<string> known)
    {
        var byPath = files.ToDictionary(f => Normalize(f.Path), StringComparer.OrdinalIgnoreCase);
        var application = files
            .FirstOrDefault(f => f.RootName == "Application" && f.ClassName is not null && known.Contains(f.ClassName))
            ?.ClassName;

        foreach (var file in files)
        {
            var source = file.ClassName is { } own && known.Contains(own) ? own : application;
            if (source is null)
            {
                continue;
            }

            foreach (var type in file.Types)
            {
                // {local:Foo} is the markup extension FooExtension.
                var target = known.Contains(type) ? type : known.Contains(type + "Extension") ? type + "Extension" : null;
                if (target is not null)
                {
                    yield return (source, target);
                }
            }

            foreach (var reference in file.Files)
            {
                var other = FindFile(reference, Path.GetDirectoryName(file.Path)!, projectDirectory, byPath);
                if (other?.ClassName is { } className && known.Contains(className))
                {
                    yield return (source, className);
                }
            }
        }
    }

    public static string Normalize(string path) => Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

    private static XamlFile? FindFile(string reference, string fileDirectory, string projectDirectory, Dictionary<string, XamlFile> byPath)
    {
        // pack://application:,,,/Assembly;component/Views/Page.xaml -> Views/Page.xaml
        var marker = reference.IndexOf(";component/", StringComparison.OrdinalIgnoreCase);
        var relative = (marker >= 0 ? reference[(marker + ";component/".Length)..] : reference).TrimStart('/', '\\');

        foreach (var baseDirectory in new[] { fileDirectory, projectDirectory })
        {
            try
            {
                if (byPath.TryGetValue(Normalize(Path.Combine(baseDirectory, relative)), out var found))
                {
                    return found;
                }
            }
            catch (ArgumentException)
            {
                // Not a path (invalid characters): nothing to find.
                return null;
            }
        }

        return null;
    }

    private static void ScanValue(XElement element, string value, List<string> types, List<string>? files)
    {
        if (files is not null && !value.Contains('{') && Extensions.Any(e => value.EndsWith(e, StringComparison.OrdinalIgnoreCase)))
        {
            files.Add(value);
        }

        if (!value.Contains(':'))
        {
            return;
        }

        foreach (Match match in PrefixedName.Matches(value))
        {
            if (element.GetNamespaceOfPrefix(match.Groups[1].Value) is { } ns)
            {
                AddType(types, ns.NamespaceName, match.Groups[2].Value, requireDot: false);
            }
        }
    }

    private static void AddType(List<string> types, string xmlNamespace, string localName, bool requireDot)
    {
        if (ClrNamespace(xmlNamespace) is not { } clr)
        {
            return;
        }

        var dot = localName.IndexOf('.');
        if (dot < 0 && requireDot)
        {
            return;
        }

        var name = dot >= 0 ? localName[..dot] : localName;
        types.Add(clr.Length == 0 ? name : $"{clr}.{name}");
    }

    /// <summary><c>clr-namespace:Shop.Views;assembly=Shop</c> (WPF) and <c>using:Shop.Views</c> (WinUI, Avalonia); null for other XML namespaces.</summary>
    private static string? ClrNamespace(string xmlNamespace)
    {
        string rest;
        if (xmlNamespace.StartsWith("clr-namespace:", StringComparison.Ordinal))
        {
            rest = xmlNamespace["clr-namespace:".Length..];
        }
        else if (xmlNamespace.StartsWith("using:", StringComparison.Ordinal))
        {
            rest = xmlNamespace["using:".Length..];
        }
        else
        {
            return null;
        }

        var semicolon = rest.IndexOf(';');
        return (semicolon >= 0 ? rest[..semicolon] : rest).Trim();
    }
}
