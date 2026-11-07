using Atlas.Analyzer.Model;
using Xunit;

namespace Atlas.Analyzer.Tests;

/// <summary>Dependency injection registrations, events and attributes.</summary>
public class NewRelationshipTests
{
    // The container is declared in the test itself: the analysis recognises it by name, so the analyzed
    // solution does not need a reference to Microsoft.Extensions.DependencyInjection.
    private const string Container = """
        namespace Microsoft.Extensions.DependencyInjection
        {
            public interface IServiceCollection { }

            public static class ServiceCollectionExtensions
            {
                public static IServiceCollection AddScoped<TService, TImplementation>(this IServiceCollection services)
                    where TImplementation : TService => services;

                public static IServiceCollection AddHostedService<T>(this IServiceCollection services) => services;

                public static IServiceCollection AddSingleton(this IServiceCollection services, System.Type service, System.Type implementation) => services;

                public static IServiceCollection AddAnything<T>(this IServiceCollection services) => services;
            }
        }
        """;

    [Fact]
    public async Task Registrations_point_from_the_registering_code_to_service_and_implementation()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", Container + """

            namespace Shop
            {
                using Microsoft.Extensions.DependencyInjection;

                public interface IOrders { }
                public class Orders : IOrders { }
                public class Worker { }
                public interface IClock { }
                public class Clock : IClock { }

                public class Startup
                {
                    public void Configure(IServiceCollection services)
                    {
                        services.AddScoped<IOrders, Orders>();
                        services.AddHostedService<Worker>();
                        services.AddSingleton(typeof(IClock), typeof(Clock));
                    }
                }
            }
            """));

        foreach (var target in new[] { "IOrders", "Orders", "Worker", "IClock", "Clock" })
        {
            Assert.NotNull(graph.Edge("Shop.Startup", $"Shop.{target}", EdgeKind.Registers));
        }
    }

    [Fact]
    public async Task A_generic_method_that_is_not_a_registration_is_not_one()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", Container + """

            namespace Shop
            {
                using Microsoft.Extensions.DependencyInjection;

                public class Thing { }

                public class Startup
                {
                    public void Configure(IServiceCollection services) => services.AddAnything<Thing>();
                }
            }
            """));

        Assert.Null(graph.Edge("Shop.Startup", "Shop.Thing", EdgeKind.Registers));
    }

    [Fact]
    public async Task Event_subscriptions_are_events_and_not_accesses()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            using System;
            namespace Shop;
            public class Button { public event EventHandler? Clicked; public void Click() => Clicked?.Invoke(this, EventArgs.Empty); }
            public class Form
            {
                public void Wire(Button button) { button.Clicked += OnClicked; }
                private void OnClicked(object? sender, EventArgs e) { }
            }
            """));

        Assert.NotNull(graph.Edge("Shop.Form", "Shop.Button", EdgeKind.Events));
        Assert.Null(graph.Edge("Shop.Form", "Shop.Button", EdgeKind.Accesses));
    }

    [Fact]
    public async Task Attributes_on_types_and_members_are_annotations()
    {
        var graph = await Analyze.BuildAsync(Analyze.CSharp("App", """
            using System;
            namespace Shop;
            public class AuditAttribute : Attribute { }
            public class MarkedType { }

            [Audit]
            public class Controller { }

            public class Service { [Audit] public void Save() { } }
            """));

        Assert.NotNull(graph.Edge("Shop.Controller", "Shop.AuditAttribute", EdgeKind.Annotated));
        Assert.NotNull(graph.Edge("Shop.Service", "Shop.AuditAttribute", EdgeKind.Annotated));
        Assert.Null(graph.Edge("Shop.Controller", "Shop.AuditAttribute", EdgeKind.Uses));
    }
}
