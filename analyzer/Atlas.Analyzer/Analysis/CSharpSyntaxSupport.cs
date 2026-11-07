using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

namespace Atlas.Analyzer.Analysis;

internal sealed class CSharpSyntaxSupport : ISyntaxSupport
{
    public static readonly CSharpSyntaxSupport Instance = new();

    private CSharpSyntaxSupport()
    {
    }

    public SyntaxNode BodyRoot(SyntaxNode declaration) => declaration;

    public SyntaxNode MemberRoot(SyntaxNode declaration) => declaration;

    // Nested types and delegates are nodes of their own and are analyzed separately. The
    // base list is already covered by "inherits" and "implements".
    public IEnumerable<SyntaxNode> Nodes(SyntaxNode root) =>
        root.DescendantNodesAndSelf(node =>
            ReferenceEquals(node, root)
            || node is not (BaseTypeDeclarationSyntax or DelegateDeclarationSyntax or BaseListSyntax));

    public INamedTypeSymbol? ReferencedType(SyntaxNode node, SemanticModel model, CancellationToken ct)
    {
        switch (node)
        {
            case SimpleNameSyntax name when name.Parent is not AttributeSyntax && IsInCode(name):
                return model.GetSymbolInfo(name, ct).Symbol as INamedTypeSymbol;

            // [Authorize] names the attribute class, but the compiler binds it to a constructor.
            case AttributeSyntax attribute:
                return model.GetSymbolInfo(attribute, ct).Symbol is IMethodSymbol { ContainingType: { } type } ? type : null;

            default:
                return null;
        }
    }

    /// <summary>
    /// The syntax nodes from which operation trees are taken. They are chosen so that every piece
    /// of code is covered once: method-like members (including constructor initializers) and
    /// accessors as a whole, expression bodies of properties, and field and property initializers.
    /// Lambdas and local functions are part of the tree of the member that contains them.
    /// </summary>
    public SyntaxNode? OperationRoot(SyntaxNode node) => node switch
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

    // "var order = factory.Create();" depends on the type of order, although it is never named.
    public bool IsInferredLocal(IVariableDeclaratorOperation declarator) =>
        declarator.Syntax.Parent is VariableDeclarationSyntax { Type.IsVar: true };

    public bool IsImplicitCreation(IObjectCreationOperation creation) =>
        creation.Syntax is ImplicitObjectCreationExpressionSyntax;

    public ForEachMembers? ForEachInfo(IForEachLoopOperation loop, SemanticModel model)
    {
        if (loop.Syntax is not CommonForEachStatementSyntax statement)
        {
            return null;
        }

        var info = model.GetForEachStatementInfo(statement);
        return new ForEachMembers(info.GetEnumeratorMethod, info.MoveNextMethod, info.DisposeMethod, info.CurrentProperty);
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
