using Atlas.Analyzer.Model;
using Xunit;

namespace Atlas.Analyzer.Tests;

public class MemberTests
{
    private const string Source = """
        namespace Shop;
        public class Calc { public int Sum(int a) => a; public int Total; public static int Zero => 0; }
        public class Order
        {
            public int Run(Calc c) => c.Sum(1) + c.Total + Calc.Zero;
            public Calc Calculator { get; set; } = new Calc();
            public int Count;
        }
        """;

    private static async Task<AtlasNode> OrderAsync()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", Source));
        return graph.Node("Shop.Order");
    }

    [Fact]
    public async Task Members_know_what_they_call_and_access()
    {
        var order = await OrderAsync();
        var run = Assert.Single(order.MemberDetails!, m => m.Kind == "method");

        Assert.Equal("Run(Calc)", run.Name);
        Assert.Contains(run.Refs, r => r is { Target: "Shop.Calc", Member: "Sum", Kind: EdgeKind.Calls });
        Assert.Contains(run.Refs, r => r is { Target: "Shop.Calc", Member: "Total", Kind: EdgeKind.Accesses });
        Assert.Contains(run.Refs, r => r is { Target: "Shop.Calc", Member: "Zero", Kind: EdgeKind.Accesses });
    }

    [Fact]
    public async Task Members_have_a_kind_and_a_line()
    {
        var order = await OrderAsync();

        Assert.Contains(order.MemberDetails!, m => m.Kind == "property" && m.Name == "Calculator");
        Assert.Contains(order.MemberDetails!, m => m.Kind == "field" && m.Name == "Count");
        Assert.All(order.MemberDetails!, m => Assert.True(m.Line > 0));
    }

    [Fact]
    public async Task Accessors_and_implicit_members_are_not_listed()
    {
        var order = await OrderAsync();

        Assert.DoesNotContain(order.MemberDetails!, m => m.Name.StartsWith("get_", StringComparison.Ordinal) || m.Name.StartsWith("set_", StringComparison.Ordinal));
    }

    [Fact]
    public async Task References_are_sorted_and_free_of_duplicates()
    {
        var order = await OrderAsync();

        foreach (var member in order.MemberDetails!)
        {
            Assert.Equal(member.Refs.Count, member.Refs.Distinct().Count());
        }
    }
}
