using Atlas.Analyzer.Analysis;
using Microsoft.CodeAnalysis;
using Xunit;

namespace Atlas.Analyzer.Tests;

/// <summary>Projects that MSBuild cannot load are read from their source files.</summary>
public sealed class SourceFallbackTests : IDisposable
{
    private readonly string _directory = Directory.CreateTempSubdirectory("atlas-fallback-").FullName;

    public void Dispose() => Directory.Delete(_directory, recursive: true);

    private string Write(string relativePath, string content)
    {
        var path = Path.Combine(_directory, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, content);
        return path;
    }

    [Fact]
    public async Task A_project_that_was_not_loaded_is_built_from_its_files()
    {
        var project = Write("Shop/Shop.vbproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><RootNamespace>Shop</RootNamespace></PropertyGroup></Project>");
        Write("Shop/Orders.vb", """
            Public Class Orders
                Public Sub Place()
                    Dim item As New Item()
                End Sub
            End Class
            Public Class Item
            End Class
            """);
        Write("Shop/obj/Generated.vb", "Public Class Generated\nEnd Class");

        using var workspace = new AdhocWorkspace();
        var solution = SourceFallback.Complete(workspace.CurrentSolution, [project]);

        var graph = await GraphBuilder.BuildAsync("test.sln", solution.Projects.ToList(), readXaml: false);
        Assert.Contains(graph.Nodes, n => n.Id == "Shop.Orders");
        Assert.DoesNotContain(graph.Nodes, n => n.Name == "Generated");
        Assert.Contains(graph.Edges, e => e.Source == "Shop.Orders" && e.Target == "Shop.Item");
    }

    [Fact]
    public void A_project_without_documents_gets_the_files_from_disk()
    {
        var project = Write("Lib/Lib.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
        Write("Lib/A.cs", "namespace Lib; public class A { }");
        Write("Lib/Sub/B.cs", "namespace Lib; public class B { }");

        using var workspace = new AdhocWorkspace();
        var id = ProjectId.CreateNewId("Lib");
        workspace.AddProject(ProjectInfo.Create(id, VersionStamp.Create(), "Lib", "Lib", LanguageNames.CSharp, filePath: project));

        var solution = SourceFallback.Complete(workspace.CurrentSolution, [project]);

        Assert.Equal(2, solution.GetProject(id)!.Documents.Count());
    }

    [Fact]
    public void A_project_with_documents_is_left_alone()
    {
        var project = Write("Lib/Lib.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
        Write("Lib/A.cs", "namespace Lib; public class A { }");

        using var workspace = new AdhocWorkspace();
        var id = ProjectId.CreateNewId("Lib");
        var info = ProjectInfo.Create(id, VersionStamp.Create(), "Lib", "Lib", LanguageNames.CSharp, filePath: project);
        workspace.AddProject(info);
        workspace.AddDocument(id, "Own.cs", Microsoft.CodeAnalysis.Text.SourceText.From("namespace Lib; public class Own { }"));

        var solution = SourceFallback.Complete(workspace.CurrentSolution, [project]);

        Assert.Single(solution.GetProject(id)!.Documents);
    }

    [Fact]
    public void An_old_style_project_uses_its_Compile_items_only()
    {
        var project = Write("Old/Old.vbproj", """
            <Project ToolsVersion="15.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
              <ItemGroup>
                <Compile Include="Listed.vb" />
              </ItemGroup>
            </Project>
            """);
        Write("Old/Listed.vb", "Public Class Listed\nEnd Class");
        Write("Old/Stray.vb", "Public Class Stray\nEnd Class");

        var files = SourceFallback.SourceFiles(project, LanguageNames.VisualBasic);

        Assert.Equal("Listed.vb", Assert.Single(files).Split(Path.DirectorySeparatorChar).Last());
    }

    [Fact]
    public void An_sdk_project_skips_build_output_and_nested_projects()
    {
        var project = Write("App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
        Write("App/Program.cs", "class P { }");
        Write("App/bin/Debug/Old.cs", "class Old { }");
        Write("App/obj/New.cs", "class New { }");
        Write("App/Tests/Tests.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
        Write("App/Tests/T.cs", "class T { }");

        var files = SourceFallback.SourceFiles(project, LanguageNames.CSharp);

        Assert.Equal(["Program.cs"], files.Select(f => Path.GetFileName(f)!).ToArray());
    }

    [Fact]
    public async Task Project_references_of_a_created_project_are_added()
    {
        var core = Write("Core/Core.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
        Write("Core/Money.cs", "namespace Core; public class Money { }");
        var app = Write("App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\"><ItemGroup><ProjectReference Include=\"..\\Core\\Core.csproj\" /></ItemGroup></Project>");
        Write("App/Cart.cs", "namespace App; public class Cart { public Core.Money Total; }");

        using var workspace = new AdhocWorkspace();
        var solution = SourceFallback.Complete(workspace.CurrentSolution, [core, app]);

        var graph = await GraphBuilder.BuildAsync("test.sln", solution.Projects.ToList(), readXaml: false);
        Assert.Contains(graph.Edges, e => e.Source == "App.Cart" && e.Target == "Core.Money");
    }

    [Fact]
    public void The_project_list_of_a_solution_contains_only_existing_C_sharp_and_VB_projects()
    {
        Write("A/A.csproj", "<Project />");
        Write("B/B.vbproj", "<Project />");
        Write("C/C.vcxproj", "<Project />");
        var solution = Write("All.sln", """
            Microsoft Visual Studio Solution File, Format Version 12.00
            Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "A", "A\A.csproj", "{11111111-1111-1111-1111-111111111111}"
            EndProject
            Project("{F184B08F-C81C-45F6-A57F-5ABD9991F28F}") = "B", "B\B.vbproj", "{22222222-2222-2222-2222-222222222222}"
            EndProject
            Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "C", "C\C.vcxproj", "{33333333-3333-3333-3333-333333333333}"
            EndProject
            Project("{2150E333-8FDC-42A3-9474-1A3956D46DE8}") = "Folder", "Folder", "{44444444-4444-4444-4444-444444444444}"
            EndProject
            Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Gone", "Gone\Gone.csproj", "{55555555-5555-5555-5555-555555555555}"
            EndProject
            """);

        var paths = SolutionFiles.ProjectPaths(solution);

        Assert.Equal(["A.csproj", "B.vbproj"], paths.Select(f => Path.GetFileName(f)!).ToArray());
    }
}
