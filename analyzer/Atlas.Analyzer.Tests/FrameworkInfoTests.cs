using Xunit;

namespace Atlas.Analyzer.Tests;

/// <summary>Base types and attributes, which tell types that a framework uses from types that are unused.</summary>
public class FrameworkInfoTests
{
    [Fact]
    public async Task Base_types_list_framework_bases_and_interfaces_but_not_object()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            using System;
            namespace Shop;
            public class Failure : Exception, IDisposable { public void Dispose() { } }
            """));

        var baseTypes = graph.Node("Shop.Failure").BaseTypes;
        Assert.NotNull(baseTypes);
        Assert.Contains("System.Exception", baseTypes);
        Assert.Contains("System.IDisposable", baseTypes);
        Assert.DoesNotContain("System.Object", baseTypes);
    }

    [Fact]
    public async Task Base_types_include_inherited_ones_and_leave_out_type_arguments()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            using System;
            using System.Collections.Generic;
            namespace Shop;
            public class Failure : Exception { }
            public class SpecialFailure : Failure { }
            public class Names : List<string> { }
            """));

        var special = graph.Node("Shop.SpecialFailure").BaseTypes;
        Assert.Contains("Shop.Failure", special!);
        Assert.Contains("System.Exception", special!);

        var names = graph.Node("Shop.Names").BaseTypes;
        Assert.Contains("System.Collections.Generic.List", names!);
        Assert.Contains("System.Collections.Generic.IList", names!);
    }

    [Fact]
    public async Task Attributes_are_collected_from_the_type_and_its_members()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            using System;
            namespace Shop;
            public class MarkAttribute : Attribute { }
            [Mark]
            public class Tests { [Obsolete] public void Works() { } }
            """));

        var attributes = graph.Node("Shop.Tests").Attributes;
        Assert.NotNull(attributes);
        Assert.Contains("Shop.MarkAttribute", attributes);
        Assert.Contains("System.ObsoleteAttribute", attributes);
    }

    [Fact]
    public async Task A_type_without_bases_and_attributes_has_neither()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            namespace Shop;
            public class Plain { }
            """));

        var node = graph.Node("Shop.Plain");
        Assert.Null(node.BaseTypes);
        Assert.Null(node.Attributes);
    }
}
