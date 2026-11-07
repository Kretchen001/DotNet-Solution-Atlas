using Atlas.Analyzer.Analysis;
using Atlas.Analyzer.Model;
using Xunit;

namespace Atlas.Analyzer.Tests;

/// <summary>Types that are only named in XAML are references too.</summary>
public class XamlTests
{
    private const string Presentation = "http://schemas.microsoft.com/winfx/2006/xaml/presentation";
    private const string Xaml = "http://schemas.microsoft.com/winfx/2006/xaml";

    private static XamlFile Parse(string body, string root = "Window", string? xClass = "Shop.Views.MainWindow") =>
        XamlReferences.Parse(
            "MainWindow.xaml",
            $"""
            <{root} xmlns="{Presentation}" xmlns:x="{Xaml}"
                    xmlns:local="clr-namespace:Shop.Views"
                    xmlns:conv="clr-namespace:Shop.Converters;assembly=Shop"
                    xmlns:ui="using:Shop.Controls"
                    {(xClass is null ? "" : $"x:Class=\"{xClass}\"")}>
                {body}
            </{root}>
            """)!;

    [Fact]
    public void Elements_and_property_elements_name_their_types()
    {
        var file = Parse("""
            <Grid><local:OrderList/><ui:Badge Count="1"/><local:OrderList.Header>x</local:OrderList.Header></Grid>
            """);

        Assert.Equal("Shop.Views.MainWindow", file.ClassName);
        Assert.Equal(2, file.Types.Count(t => t == "Shop.Views.OrderList"));
        Assert.Contains("Shop.Controls.Badge", file.Types);
        Assert.DoesNotContain(file.Types, t => t.StartsWith("http", StringComparison.Ordinal));
    }

    [Fact]
    public void Markup_extensions_and_attached_properties_name_their_types()
    {
        var file = Parse("""
            <Grid conv:Behaviors.Mode="Fast" Tag="{x:Static local:Defaults.Title}">
              <Grid.Resources>
                <DataTemplate DataType="{x:Type local:Order}"/>
                <Style TargetType="local:Card"/>
              </Grid.Resources>
              <TextBlock Text="{Binding Total, Converter={conv:Money}}"/>
            </Grid>
            """);

        Assert.Contains("Shop.Converters.Behaviors", file.Types);
        Assert.Contains("Shop.Views.Defaults", file.Types);
        Assert.Contains("Shop.Views.Order", file.Types);
        Assert.Contains("Shop.Views.Card", file.Types);
        Assert.Contains("Shop.Converters.Money", file.Types);
    }

    [Fact]
    public void Files_that_are_loaded_by_name_are_collected()
    {
        var file = Parse("""<Grid><ResourceDictionary Source="/Themes/Dark.xaml"/></Grid>""");
        Assert.Equal("/Themes/Dark.xaml", Assert.Single(file.Files));
    }

    [Fact]
    public void A_file_that_is_not_xml_is_skipped()
    {
        Assert.Null(XamlReferences.Parse("Broken.xaml", "<Window"));
    }

    [Fact]
    public async Task Edges_go_from_the_code_behind_type_to_the_types_in_the_xaml()
    {
        var directory = Directory.CreateTempSubdirectory("atlas-xaml-").FullName;
        try
        {
            File.WriteAllText(Path.Combine(directory, "MainWindow.xaml"), $"""
                <Window xmlns="{Presentation}" xmlns:x="{Xaml}" x:Class="Shop.MainWindow"
                        xmlns:local="clr-namespace:Shop">
                    <Window.Resources><local:MoneyConverter x:Key="Money"/></Window.Resources>
                    <local:OrderView/>
                </Window>
                """);
            File.WriteAllText(Path.Combine(directory, "App.xaml"), $"""
                <Application xmlns="{Presentation}" xmlns:x="{Xaml}" x:Class="Shop.App" StartupUri="MainWindow.xaml">
                    <Application.Resources>
                        <ResourceDictionary Source="Themes/Dark.xaml"/>
                    </Application.Resources>
                </Application>
                """);
            Directory.CreateDirectory(Path.Combine(directory, "Themes"));
            File.WriteAllText(Path.Combine(directory, "Themes", "Dark.xaml"), $"""
                <ResourceDictionary xmlns="{Presentation}" xmlns:x="{Xaml}" xmlns:local="clr-namespace:Shop">
                    <local:ThemeHelper x:Key="Helper"/>
                </ResourceDictionary>
                """);

            var graph = await Analyze.BuildAsync(new TestProject
            {
                Name = "Shop",
                Language = "C#",
                Directory = directory,
                Source = """
                    namespace Shop;
                    public partial class App { }
                    public partial class MainWindow { }
                    public class MoneyConverter { }
                    public class OrderView { }
                    public class ThemeHelper { }
                    public class Lonely { }
                    """,
            });

            Assert.NotNull(graph.Edge("Shop.MainWindow", "Shop.MoneyConverter", EdgeKind.Xaml));
            Assert.NotNull(graph.Edge("Shop.MainWindow", "Shop.OrderView", EdgeKind.Xaml));
            Assert.NotNull(graph.Edge("Shop.App", "Shop.MainWindow", EdgeKind.Xaml)); // StartupUri
            Assert.NotNull(graph.Edge("Shop.App", "Shop.ThemeHelper", EdgeKind.Xaml)); // resource dictionary counts for App
            Assert.DoesNotContain(graph.Edges, e => e.Target == "Shop.Lonely");
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    [Fact]
    public async Task Xaml_can_be_switched_off()
    {
        var directory = Directory.CreateTempSubdirectory("atlas-xaml-").FullName;
        try
        {
            File.WriteAllText(Path.Combine(directory, "MainWindow.xaml"), $"""
                <Window xmlns="{Presentation}" xmlns:x="{Xaml}" x:Class="Shop.MainWindow" xmlns:local="clr-namespace:Shop">
                    <local:OrderView/>
                </Window>
                """);

            var project = new TestProject
            {
                Name = "Shop",
                Language = "C#",
                Directory = directory,
                Source = "namespace Shop; public partial class MainWindow { } public class OrderView { }",
            };

            Assert.NotEmpty((await Analyze.BuildAsync(project)).Edges);
            Assert.Empty((await Analyze.BuildAsync(readXaml: false, project)).Edges);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }
}
