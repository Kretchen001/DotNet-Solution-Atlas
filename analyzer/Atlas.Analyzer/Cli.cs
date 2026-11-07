using System.Runtime.CompilerServices;
using System.Text.Json;
using Atlas.Analyzer.Analysis;
using Atlas.Analyzer.Model;
using Microsoft.Build.Locator;

namespace Atlas.Analyzer;

/// <summary>Command line handling: parses arguments and writes the resulting graph as JSON.</summary>
internal static class Cli
{
    private const string Usage = """
        Atlas.Analyzer - writes the type dependency graph of a .NET solution as JSON.

        Usage:
          Atlas.Analyzer <path to .sln, .slnx, .slnf, .csproj or .vbproj> [--out <file>] [--no-xaml]

        Options:
          --out <file>   Write the JSON to a file instead of standard output.
          --no-xaml      Do not read .xaml / .axaml files for the types they use.
          -h, --help     Show this help.

        Diagnostics and progress are written to standard error, so standard
        output contains nothing but the JSON document.

        Exit codes: 0 success, 1 invalid arguments, 2 no .NET SDK found, 3 analysis failed.
        """;

    public static async Task<int> RunAsync(string[] args)
    {
        if (args.Contains("-h") || args.Contains("--help"))
        {
            Console.Out.WriteLine(Usage);
            return 0;
        }

        if (args.Length == 0)
        {
            Console.Error.WriteLine(Usage);
            return 1;
        }

        var input = Path.GetFullPath(args[0]);
        string? outPath = null;
        var readXaml = true;

        for (var i = 1; i < args.Length; i++)
        {
            if (args[i] == "--out" && i + 1 < args.Length)
            {
                outPath = Path.GetFullPath(args[++i]);
            }
            else if (args[i] == "--no-xaml")
            {
                readXaml = false;
            }
            else
            {
                Console.Error.WriteLine($"Unknown or incomplete argument: {args[i]}");
                return 1;
            }
        }

        if (!File.Exists(input))
        {
            Console.Error.WriteLine($"File not found: {input}");
            return 1;
        }

        // MSBuild has to be located before any MSBuild type is loaded, which is
        // why the actual work lives in a separate method.
        try
        {
            MSBuildLocator.RegisterDefaults();
        }
        catch (InvalidOperationException ex)
        {
            Console.Error.WriteLine($"No usable .NET SDK found: {ex.Message}");
            Console.Error.WriteLine(
                "Note: only SDKs that are not newer than the runtime running this tool can be used. " +
                "Check 'dotnet --list-sdks' and 'dotnet --list-runtimes'.");
            return 2;
        }

        try
        {
            return await AnalyzeAsync(input, outPath, readXaml);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Analysis failed: {ex.Message}");
            return 3;
        }
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static async Task<int> AnalyzeAsync(string input, string? outPath, bool readXaml)
    {
        Console.Error.WriteLine($"Loading {input} ...");
        using var workspace = await LoadedWorkspace.OpenAsync(input);
        Console.Error.WriteLine($"Loaded {workspace.Projects.Count} project(s).");

        var graph = await GraphBuilder.BuildAsync(input, workspace.Projects, readXaml);
        await WriteAsync(graph, outPath);
        return 0;
    }

    private static async Task WriteAsync(AtlasGraph graph, string? outPath)
    {
        // Always UTF-8 without BOM, independent of the console code page.
        if (outPath is null)
        {
            await using var stdout = Console.OpenStandardOutput();
            await JsonSerializer.SerializeAsync(stdout, graph, AtlasJson.Options);
        }
        else
        {
            await using var file = new FileStream(outPath, FileMode.Create, FileAccess.Write);
            await JsonSerializer.SerializeAsync(file, graph, AtlasJson.Options);
        }
    }
}
