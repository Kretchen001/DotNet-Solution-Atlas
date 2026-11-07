using Xunit;

namespace Atlas.Analyzer.Tests;

/// <summary>
/// Projects that were loaded without their references (the source fallback, failed package restores) are full of
/// types that cannot be resolved. They must not stop the analysis.
/// </summary>
public class UnresolvedTypesTests
{
    [Fact]
    public async Task Unresolved_base_types_members_and_calls_do_not_break_the_analysis()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            namespace Shop;

            [Missing.Marker]
            public class Page : Missing.BasePage, Missing.IThing
            {
                private Missing.Widget _widget = new Missing.Widget();

                public Known Create(Missing.Arg arg)
                {
                    var local = new Missing.Widget();
                    local.Open(arg);
                    return new Known();
                }
            }

            public class Known { }
            """));

        Assert.Contains(graph.Nodes, n => n.Id == "Shop.Page");
        Assert.NotNull(graph.Edge("Shop.Page", "Shop.Known", Model.EdgeKind.Uses));
        Assert.DoesNotContain(graph.Edges, e => e.Target.StartsWith('?'));
    }

    [Fact]
    public async Task Unresolved_types_in_visual_basic_do_not_break_the_analysis()
    {
        var graph = await Analyze.BuildAsync(Analyze.VisualBasic("App", """
            Public Class Form1
                Inherits Missing.Form
                Private ReadOnly _grid As Missing.Grid
                Public Sub Open()
                    Dim helper As New Helper()
                    _grid.Refresh()
                End Sub
            End Class

            Public Class Helper
            End Class
            """));

        Assert.Contains(graph.Nodes, n => n.Name == "Form1");
        Assert.Contains(graph.Edges, e => e.Target.EndsWith("Helper", StringComparison.Ordinal));
    }
}
