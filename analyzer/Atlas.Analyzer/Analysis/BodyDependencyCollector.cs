using Atlas.Analyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

namespace Atlas.Analyzer.Analysis;

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
        var result = new List<(string Target, EdgeKind Kind)>();

        if (SyntaxSupport.For(compilation.Language) is not { } syntax)
        {
            return result;
        }

        foreach (var reference in type.DeclaringSyntaxReferences)
        {
            Walk(syntax.BodyRoot(reference.GetSyntax(ct)), syntax, compilation, result, ct);
        }

        return result;
    }

    /// <summary>The code of a C# file with top-level statements, which belongs to no declared type.</summary>
    public static List<(string Target, EdgeKind Kind)> CollectTopLevel(
        IEnumerable<GlobalStatementSyntax> statements,
        Compilation compilation,
        CancellationToken ct = default)
    {
        var result = new List<(string Target, EdgeKind Kind)>();

        foreach (var statement in statements)
        {
            Walk(statement, CSharpSyntaxSupport.Instance, compilation, result, ct);
        }

        return result;
    }

    private static void Walk(
        SyntaxNode root,
        ISyntaxSupport syntax,
        Compilation compilation,
        List<(string Target, EdgeKind Kind)> result,
        CancellationToken ct)
    {
        var model = compilation.GetSemanticModel(root.SyntaxTree);

        foreach (var node in syntax.Nodes(root))
        {
            if (syntax.ReferencedType(node, model, ct) is { } named)
            {
                result.Add((SymbolIds.For(named), EdgeKind.Uses));
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
        List<(string Target, EdgeKind Kind)> result)
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
                AddMember(@event.Event, result);
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

    private static void AddMethod(IMethodSymbol? method, List<(string Target, EdgeKind Kind)> result)
    {
        if (method is null || method.MethodKind is MethodKind.LocalFunction or MethodKind.AnonymousFunction)
        {
            return;
        }

        // For an extension method called like an instance method this is the static class.
        if ((method.ReducedFrom ?? method).ContainingType is { } owner)
        {
            result.Add((SymbolIds.For(owner), EdgeKind.Calls));
        }
    }

    private static void AddMember(ISymbol? member, List<(string Target, EdgeKind Kind)> result)
    {
        if (member?.ContainingType is { } owner)
        {
            result.Add((SymbolIds.For(owner), EdgeKind.Accesses));
        }
    }

    private static void AddTypes(ITypeSymbol? type, EdgeKind kind, List<(string Target, EdgeKind Kind)> result)
    {
        foreach (var named in DependencyCollector.Named(type))
        {
            result.Add((SymbolIds.For(named), kind));
        }
    }
}
