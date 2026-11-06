using Atlas.Analyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
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
/// <item>"uses": types named in code, attributes, <c>typeof</c>, <c>new()</c>, <c>var</c> locals</item>
/// </list>
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

        foreach (var reference in type.DeclaringSyntaxReferences)
        {
            Walk(reference.GetSyntax(ct), compilation, result, ct);
        }

        return result;
    }

    /// <summary>The code of a file with top-level statements, which belongs to no declared type.</summary>
    public static List<(string Target, EdgeKind Kind)> CollectTopLevel(
        IEnumerable<GlobalStatementSyntax> statements,
        Compilation compilation,
        CancellationToken ct = default)
    {
        var result = new List<(string Target, EdgeKind Kind)>();

        foreach (var statement in statements)
        {
            Walk(statement, compilation, result, ct);
        }

        return result;
    }

    private static void Walk(
        SyntaxNode root,
        Compilation compilation,
        List<(string Target, EdgeKind Kind)> result,
        CancellationToken ct)
    {
        var model = compilation.GetSemanticModel(root.SyntaxTree);

        // Nested types and delegates are nodes of their own and are analyzed separately. The
        // base list is already covered by "inherits" and "implements".
        var nodes = root.DescendantNodesAndSelf(node =>
            ReferenceEquals(node, root)
            || node is not (BaseTypeDeclarationSyntax or DelegateDeclarationSyntax or BaseListSyntax));

        foreach (var node in nodes)
        {
            switch (node)
            {
                case SimpleNameSyntax name when name.Parent is not AttributeSyntax && IsInCode(name):
                    if (model.GetSymbolInfo(name, ct).Symbol is INamedTypeSymbol named)
                    {
                        result.Add((SymbolIds.For(named), EdgeKind.Uses));
                    }

                    break;

                // [Authorize] names the attribute class, but the compiler binds it to a constructor.
                case AttributeSyntax attribute:
                    if (model.GetSymbolInfo(attribute, ct).Symbol is IMethodSymbol { ContainingType: { } attributeType })
                    {
                        result.Add((SymbolIds.For(attributeType), EdgeKind.Uses));
                    }

                    break;
            }

            if (OperationRoot(node) is { } operationRoot && model.GetOperation(operationRoot, ct) is { } operation)
            {
                foreach (var child in operation.DescendantsAndSelf())
                {
                    AddFromOperation(child, model, result);
                }
            }
        }
    }

    /// <summary>
    /// The syntax nodes from which operation trees are taken. They are chosen so that every piece
    /// of code is covered once: method-like members (including constructor initializers) and
    /// accessors as a whole, expression bodies of properties, and field and property initializers.
    /// Lambdas and local functions are part of the tree of the member that contains them.
    /// </summary>
    private static SyntaxNode? OperationRoot(SyntaxNode node) => node switch
    {
        BaseMethodDeclarationSyntax => node,
        AccessorDeclarationSyntax => node,
        PropertyDeclarationSyntax { ExpressionBody: { } body } => body.Expression,
        IndexerDeclarationSyntax { ExpressionBody: { } body } => body.Expression,
        PropertyDeclarationSyntax { Initializer: { } initializer } => initializer.Value,
        EqualsValueClauseSyntax
        {
            Parent: VariableDeclaratorSyntax
            {
                Parent: VariableDeclarationSyntax { Parent: FieldDeclarationSyntax or EventFieldDeclarationSyntax },
            },
        } clause => clause.Value,
        GlobalStatementSyntax global => global.Statement,
        _ => null,
    };

    private static void AddFromOperation(
        IOperation operation,
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
                if (creation.Syntax is ImplicitObjectCreationExpressionSyntax)
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
            case IForEachLoopOperation { Syntax: CommonForEachStatementSyntax loop }:
            {
                var info = model.GetForEachStatementInfo(loop);
                AddMethod(info.GetEnumeratorMethod, result);
                AddMethod(info.MoveNextMethod, result);
                AddMethod(info.DisposeMethod, result);
                AddMember(info.CurrentProperty, result);
                break;
            }

            // "var order = factory.Create();" depends on the type of order, although it is never named.
            case IVariableDeclaratorOperation { Syntax.Parent: VariableDeclarationSyntax { Type.IsVar: true } } declarator:
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

    /// <summary>
    /// True for names inside executable code, initializers and attributes, and for the parameters
    /// of a primary constructor or positional record. Names in member signatures are not counted
    /// here, <see cref="DependencyCollector"/> already did that.
    /// </summary>
    private static bool IsInCode(SyntaxNode name)
    {
        foreach (var ancestor in name.Ancestors())
        {
            switch (ancestor)
            {
                case BlockSyntax or ArrowExpressionClauseSyntax or EqualsValueClauseSyntax
                    or ConstructorInitializerSyntax or AttributeListSyntax or GlobalStatementSyntax:
                    return true;

                case ParameterListSyntax { Parent: TypeDeclarationSyntax }:
                    return true;

                case BaseTypeDeclarationSyntax:
                    return false;
            }
        }

        return false;
    }
}
