using Atlas.Analyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

namespace Atlas.Analyzer.Analysis;

/// <summary>A reference found in code: the type it points to, how, and the member if there is one.</summary>
internal readonly record struct Reference(string Target, EdgeKind Kind, string? Member = null);

/// <summary>
/// Finds what the code of a type refers to, which the signatures alone do not show.
/// Members are found through Roslyn's operation tree, so implicit calls are seen as well:
/// operators, conversions, indexers, <c>foreach</c>, collection initializers, query expressions.
/// <list type="bullet">
/// <item>"calls": methods, constructors, operators, delegate invocations (static or not,
/// extension methods resolve to their static class)</item>
/// <item>"accesses": properties, indexers, fields, events (also enum members)</item>
/// <item>"uses": types named in code, attributes, <c>typeof</c>, <c>new()</c>, inferred locals</item>
/// </list>
/// The operation tree is the same for all languages; what differs (which syntax nodes belong to a
/// type, where trees start) is provided by <see cref="ISyntaxSupport"/>.
/// Like <see cref="DependencyCollector"/>, targets are reported per occurrence and the caller filters them.
/// </summary>
internal static class BodyDependencyCollector
{
    public static List<(string Target, EdgeKind Kind)> Collect(
        INamedTypeSymbol type,
        Compilation compilation,
        CancellationToken ct = default)
    {
        var result = new List<Reference>();

        if (SyntaxSupport.For(compilation.Language) is not { } syntax)
        {
            return [];
        }

        foreach (var reference in type.DeclaringSyntaxReferences)
        {
            Walk(syntax.BodyRoot(reference.GetSyntax(ct)), syntax, compilation, result, ct);
        }

        return ToTargets(result);
    }

    /// <summary>
    /// What the code of one member refers to, with the name of the called or accessed member.
    /// <paramref name="declaration"/> is what the symbol of the member points at.
    /// </summary>
    public static List<Reference> CollectMember(
        SyntaxNode declaration,
        Compilation compilation,
        CancellationToken ct = default)
    {
        var result = new List<Reference>();

        if (SyntaxSupport.For(compilation.Language) is { } syntax)
        {
            Walk(syntax.MemberRoot(declaration), syntax, compilation, result, ct);
        }

        return result;
    }

    private static List<(string Target, EdgeKind Kind)> ToTargets(List<Reference> references) =>
        references.Select(r => (r.Target, r.Kind)).ToList();

    /// <summary>The code of a C# file with top-level statements, which belongs to no declared type.</summary>
    public static List<(string Target, EdgeKind Kind)> CollectTopLevel(
        IEnumerable<GlobalStatementSyntax> statements,
        Compilation compilation,
        CancellationToken ct = default)
    {
        var result = new List<Reference>();

        foreach (var statement in statements)
        {
            Walk(statement, CSharpSyntaxSupport.Instance, compilation, result, ct);
        }

        return ToTargets(result);
    }

    private static void Walk(
        SyntaxNode root,
        ISyntaxSupport syntax,
        Compilation compilation,
        List<Reference> result,
        CancellationToken ct)
    {
        var model = compilation.GetSemanticModel(root.SyntaxTree);

        foreach (var node in syntax.Nodes(root))
        {
            if (syntax.ReferencedType(node, model, ct) is { } named)
            {
                // [Authorize] marks the type, which is more than just naming a class.
                result.Add(new Reference(SymbolIds.For(named), syntax.IsAttribute(node) ? EdgeKind.Annotated : EdgeKind.Uses));
            }

            if (syntax.OperationRoot(node) is { } operationRoot && model.GetOperation(operationRoot, ct) is { } operation)
            {
                foreach (var child in operation.DescendantsAndSelf())
                {
                    AddFromOperation(child, syntax, model, result);
                }
            }
        }
    }

    private static void AddFromOperation(
        IOperation operation,
        ISyntaxSupport syntax,
        SemanticModel model,
        List<Reference> result)
    {
        // User-defined operators and conversions are calls, too: a + b, (Money)x, x++.
        var operatorMethod = operation switch
        {
            IBinaryOperation binary => binary.OperatorMethod,
            IUnaryOperation unary => unary.OperatorMethod,
            IConversionOperation conversion => conversion.OperatorMethod,
            ICompoundAssignmentOperation compound => compound.OperatorMethod,
            IIncrementOrDecrementOperation increment => increment.OperatorMethod,
            _ => null,
        };

        AddMethod(operatorMethod, result);

        switch (operation)
        {
            case IInvocationOperation invocation:
                AddMethod(invocation.TargetMethod, result);
                AddRegistrations(invocation, result);
                break;

            case IObjectCreationOperation creation:
                AddMethod(creation.Constructor, result);

                // "new()" does not name the type, so the name scan cannot see it.
                if (syntax.IsImplicitCreation(creation))
                {
                    AddTypes(creation.Type, EdgeKind.Uses, result);
                }

                break;

            case IMethodReferenceOperation reference:
                AddMethod(reference.Method, result);
                break;

            case IPropertyReferenceOperation property:
                AddMember(property.Property, result);
                break;

            case IFieldReferenceOperation field:
                AddMember(field.Field, result);
                break;

            case IEventReferenceOperation @event:
                AddMember(@event.Event, result, EdgeKind.Events);
                break;

            // foreach calls GetEnumerator, MoveNext, Current and Dispose without naming them.
            case IForEachLoopOperation loop:
                if (syntax.ForEachInfo(loop, model) is { } info)
                {
                    AddMethod(info.GetEnumeratorMethod, result);
                    AddMethod(info.MoveNextMethod, result);
                    AddMethod(info.DisposeMethod, result);
                    AddMember(info.CurrentProperty, result);
                }

                break;

            case IVariableDeclaratorOperation declarator when syntax.IsInferredLocal(declarator):
                AddTypes(declarator.Symbol.Type, EdgeKind.Uses, result);
                break;
        }
    }

    private static void AddMethod(IMethodSymbol? method, List<Reference> result)
    {
        if (method is null || method.MethodKind is MethodKind.LocalFunction or MethodKind.AnonymousFunction)
        {
            return;
        }

        // For an extension method called like an instance method this is the static class.
        if ((method.ReducedFrom ?? method).ContainingType is { } owner)
        {
            result.Add(new Reference(SymbolIds.For(owner), EdgeKind.Calls, MemberName(method)));
        }
    }

    /// <summary>The name shown for a called method; the compiler calls every constructor <c>.ctor</c>, so it is shown with the name of its type.</summary>
    private static string MemberName(IMethodSymbol method) =>
        method.MethodKind is MethodKind.Constructor or MethodKind.StaticConstructor ? method.ContainingType.Name : method.Name;

    private static void AddMember(ISymbol? member, List<Reference> result, EdgeKind kind = EdgeKind.Accesses)
    {
        if (member?.ContainingType is { } owner)
        {
            result.Add(new Reference(SymbolIds.For(owner), kind, member.Name));
        }
    }

    /// <summary>
    /// The methods of the dependency injection container that register a service.
    /// Found by name, so the analyzed solution does not need a reference to Microsoft.Extensions.DependencyInjection
    /// to be understood, and other containers with the same extension methods work as well.
    /// </summary>
    private static bool IsRegistration(string name)
    {
        var rest = name.StartsWith("TryAdd", StringComparison.Ordinal) ? name["TryAdd".Length..]
            : name.StartsWith("Add", StringComparison.Ordinal) ? name["Add".Length..]
            : null;

        if (rest is null)
        {
            return false;
        }

        if (rest.StartsWith("Keyed", StringComparison.Ordinal))
        {
            rest = rest["Keyed".Length..];
        }

        return rest is "Singleton" or "Scoped" or "Transient" or "HostedService" or "DbContext" or "DbContextPool" or "HttpClient";
    }

    /// <summary>
    /// <c>services.AddScoped&lt;IOrders, Orders&gt;()</c> and <c>AddScoped(typeof(IOrders), typeof(Orders))</c>:
    /// the registering code depends on the service and on the implementation it chooses.
    /// </summary>
    private static void AddRegistrations(IInvocationOperation invocation, List<Reference> result)
    {
        var method = invocation.TargetMethod;
        var definition = method.ReducedFrom ?? method;

        if (!IsRegistration(method.Name) || definition.Parameters.FirstOrDefault()?.Type.Name != "IServiceCollection")
        {
            return;
        }

        foreach (var argument in method.TypeArguments)
        {
            if (argument is INamedTypeSymbol named)
            {
                result.Add(new Reference(SymbolIds.For(named), EdgeKind.Registers));
            }
        }

        foreach (var argument in invocation.Arguments)
        {
            if (argument.Value is ITypeOfOperation { TypeOperand: INamedTypeSymbol named })
            {
                result.Add(new Reference(SymbolIds.For(named), EdgeKind.Registers));
            }
        }
    }

    private static void AddTypes(ITypeSymbol? type, EdgeKind kind, List<Reference> result)
    {
        foreach (var named in DependencyCollector.Named(type))
        {
            result.Add(new Reference(SymbolIds.For(named), kind));
        }
    }
}
