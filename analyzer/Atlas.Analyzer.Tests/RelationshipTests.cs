using Atlas.Analyzer.Model;
using Xunit;

namespace Atlas.Analyzer.Tests;

public class RelationshipTests
{
    [Fact]
    public async Task Inheritance_and_implementation_are_told_apart()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            namespace Shop;
            public interface IShape { }
            public interface IRound : IShape { }
            public class Shape : IShape { }
            public class Circle : Shape, IRound { }
            """));

        Assert.NotNull(graph.Edge("Shop.Shape", "Shop.IShape", EdgeKind.Implements));
        Assert.NotNull(graph.Edge("Shop.Circle", "Shop.Shape", EdgeKind.Inherits));
        Assert.NotNull(graph.Edge("Shop.Circle", "Shop.IRound", EdgeKind.Implements));

        // An interface that extends another one inherits, it does not implement.
        Assert.NotNull(graph.Edge("Shop.IRound", "Shop.IShape", EdgeKind.Inherits));
    }

    [Fact]
    public async Task Types_of_the_node_list_have_kind_namespace_and_project()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            namespace Shop.Domain;
            public interface IThing { }
            public struct Point { }
            public enum Color { Red }
            public record Money(int Amount);
            public delegate void Handler();
            public static class Helper { }
            """));

        Assert.Equal(NodeKind.Interface, graph.Node("Shop.Domain.IThing").Kind);
        Assert.Equal(NodeKind.Struct, graph.Node("Shop.Domain.Point").Kind);
        Assert.Equal(NodeKind.Enum, graph.Node("Shop.Domain.Color").Kind);
        Assert.Equal(NodeKind.Record, graph.Node("Shop.Domain.Money").Kind);
        Assert.Equal(NodeKind.Delegate, graph.Node("Shop.Domain.Handler").Kind);

        var helper = graph.Node("Shop.Domain.Helper");
        Assert.True(helper.IsStatic);
        Assert.Equal("Shop.Domain", helper.Namespace);
        Assert.Equal("App", helper.Project);
        Assert.Equal("csharp", helper.Language);
    }

    [Fact]
    public async Task Generic_types_use_their_open_definition_and_type_arguments_are_uses()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            namespace Shop;
            public class Order { }
            public class Repository<T> { }
            public class OrderRepo : Repository<Order> { }
            """));

        Assert.Equal("Repository<T>", graph.Node("Shop.Repository<T>").Name);
        Assert.NotNull(graph.Edge("Shop.OrderRepo", "Shop.Repository<T>", EdgeKind.Inherits));
        Assert.NotNull(graph.Edge("Shop.OrderRepo", "Shop.Order", EdgeKind.Uses));
    }

    [Fact]
    public async Task Signatures_and_the_number_of_occurrences_make_the_weight()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            namespace Shop;
            public class B { }
            public class A { private B x; private B y; }
            """));

        Assert.Equal(2, graph.Edge("Shop.A", "Shop.B", EdgeKind.Uses)?.Weight);
    }

    [Fact]
    public async Task Calls_and_accesses_are_found_in_bodies_including_static_members()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            namespace Shop;
            public class Calc { public int Sum(int a) => a; public int Total; public static int Zero => 0; }
            public class Order { public int Run(Calc c) => c.Sum(1) + c.Total + Calc.Zero; }
            """));

        Assert.NotNull(graph.Edge("Shop.Order", "Shop.Calc", EdgeKind.Calls));
        Assert.NotNull(graph.Edge("Shop.Order", "Shop.Calc", EdgeKind.Accesses));
    }

    [Fact]
    public async Task Nested_types_are_nodes_of_their_own()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            namespace Shop;
            public class Outer { public class Inner { } }
            """));

        Assert.Contains(graph.Nodes, n => n.Id == "Shop.Outer.Inner");
    }

    [Fact]
    public async Task Self_references_and_types_outside_the_solution_are_left_out()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            using System.Collections.Generic;
            namespace Shop;
            public class Node { public Node Next; public List<string> Names = new(); public void Run() { Run(); } }
            """));

        Assert.Empty(graph.Edges);
    }

    [Fact]
    public async Task Every_edge_connects_two_nodes_of_the_graph()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            using System;
            namespace Shop;
            public class A : Exception { public B B => new B(); }
            public class B { public Func<A, int> F; }
            """));

        var ids = graph.Nodes.Select(n => n.Id).ToHashSet();
        Assert.NotEmpty(graph.Edges);
        Assert.All(graph.Edges, e =>
        {
            Assert.Contains(e.Source, ids);
            Assert.Contains(e.Target, ids);
        });
    }

    [Fact]
    public async Task Top_level_statements_become_a_node_of_their_own()
    {
        var project = new TestProject
        {
            Name = "App",
            Language = "C#",
            Executable = true,
            Source = """
                using Shop;
                var order = new Order();
                order.Confirm();

                namespace Shop
                {
                    public class Order { public void Confirm() { } }
                }
                """,
        };

        var graph = await Analyze.BuildAsync(project);

        var node = graph.Node("App.<top-level statements>");
        Assert.Equal("", node.Namespace);
        Assert.NotNull(graph.Edge(node.Id, "Shop.Order", EdgeKind.Calls));
        Assert.NotNull(graph.Edge(node.Id, "Shop.Order", EdgeKind.Uses));
    }

    [Fact]
    public async Task Visual_Basic_is_analyzed_and_mixed_solutions_are_connected()
    {
        var core = Analyze.CSharp("Core", """
            namespace Shop;
            public interface IOrder { }
            public class Order : IOrder { public void Confirm() { } }
            """);

        var legacy = Analyze.VisualBasic("Legacy", """
            Namespace Legacy
                Public Class Importer
                    Implements Shop.IOrder

                    Public Sub Run()
                        Dim o As New Shop.Order()
                        o.Confirm()
                    End Sub
                End Class
            End Namespace
            """, "Core");

        var graph = await Analyze.BuildAsync(core, legacy);

        Assert.Equal("visualbasic", graph.Node("Legacy.Importer").Language);
        Assert.Equal("csharp", graph.Node("Shop.Order").Language);
        Assert.NotNull(graph.Edge("Legacy.Importer", "Shop.IOrder", EdgeKind.Implements));
        Assert.NotNull(graph.Edge("Legacy.Importer", "Shop.Order", EdgeKind.Calls));
        Assert.NotNull(graph.Edge("Legacy.Importer", "Shop.Order", EdgeKind.Uses));
    }
}
