using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.Operations;
using Microsoft.CodeAnalysis.VisualBasic;
using Microsoft.CodeAnalysis.VisualBasic.Syntax;

namespace Atlas.Analyzer.Analysis;

internal sealed class VisualBasicSyntaxSupport : ISyntaxSupport
{
    public static readonly VisualBasicSyntaxSupport Instance = new();

    private VisualBasicSyntaxSupport()
    {
    }

    // The symbol points at the statement that opens the declaration ("Class Order"). The members
    // are in the block around it ("Class ... End Class").
    public SyntaxNode BodyRoot(SyntaxNode declaration) =>
        declaration is (TypeStatementSyntax or EnumStatementSyntax) && declaration.Parent is { } block
            ? block
            : declaration;

    // A method symbol points at its header ("Sub Confirm()"), a field at the name in
    // "Private _total As Decimal". The body is in the block around the header, or in the declarator.
    public SyntaxNode MemberRoot(SyntaxNode declaration) => declaration switch
    {
        ModifiedIdentifierSyntax { Parent: VariableDeclaratorSyntax declarator } => declarator,
        MethodBaseSyntax { Parent: MethodBlockBaseSyntax or PropertyBlockSyntax or EventBlockSyntax } => declaration.Parent!,
        _ => declaration,
    };

    public bool IsAttribute(SyntaxNode node) => node is AttributeSyntax;

    // Nested types are nodes of their own. Inherits and Implements are already covered by the
    // "inherits" and "implements" edges.
    public IEnumerable<SyntaxNode> Nodes(SyntaxNode root) =>
        root.DescendantNodesAndSelf(node =>
            ReferenceEquals(node, root)
            || node is not (TypeBlockSyntax or EnumBlockSyntax or DelegateStatementSyntax
                or InheritsStatementSyntax or ImplementsStatementSyntax));

    public INamedTypeSymbol? ReferencedType(SyntaxNode node, SemanticModel model, CancellationToken ct)
    {
        switch (node)
        {
            case SimpleNameSyntax name when name.Parent is not AttributeSyntax && IsInCode(name):
                return model.GetSymbolInfo(name, ct).Symbol as INamedTypeSymbol;

            case AttributeSyntax attribute:
                return model.GetSymbolInfo(attribute, ct).Symbol is IMethodSymbol { ContainingType: { } type } ? type : null;

            default:
                return null;
        }
    }

    // Methods, constructors, operators and accessors as a whole, plus the initializers of fields and
    // properties ("Private _items As New List(Of Order)", "Property Total As Decimal = 0").
    public SyntaxNode? OperationRoot(SyntaxNode node) => node switch
    {
        MethodBlockBaseSyntax => node,
        PropertyStatementSyntax { Initializer: { } initializer } => initializer.Value,
        PropertyStatementSyntax { AsClause: AsNewClauseSyntax asNew } => asNew.NewExpression,
        VariableDeclaratorSyntax { Parent: FieldDeclarationSyntax, Initializer: { } initializer } => initializer.Value,
        VariableDeclaratorSyntax { Parent: FieldDeclarationSyntax, AsClause: AsNewClauseSyntax asNew } => asNew.NewExpression,
        _ => null,
    };

    // "Dim order = factory.Create()": no "As" clause, the type is inferred.
    public bool IsInferredLocal(IVariableDeclaratorOperation declarator)
    {
        var declaration = declarator.Syntax as VariableDeclaratorSyntax
            ?? declarator.Syntax.Parent as VariableDeclaratorSyntax;

        return declaration is { AsClause: null };
    }

    // Visual Basic always names the type in "New Order()".
    public bool IsImplicitCreation(IObjectCreationOperation creation) => false;

    public ForEachMembers? ForEachInfo(IForEachLoopOperation loop, SemanticModel model)
    {
        if (loop.Syntax is not ForEachBlockSyntax block)
        {
            return null;
        }

        var info = model.GetForEachStatementInfo(block);
        return new ForEachMembers(info.GetEnumeratorMethod, info.MoveNextMethod, info.DisposeMethod, info.CurrentProperty);
    }

    /// <summary>
    /// True for names inside executable statements, initializers ("= value") and attributes.
    /// Names in the header of a member (parameters, "As" clauses) belong to the signature,
    /// which <see cref="DependencyCollector"/> already covers.
    /// </summary>
    private static bool IsInCode(SyntaxNode name)
    {
        foreach (var ancestor in name.Ancestors())
        {
            switch (ancestor)
            {
                case ExecutableStatementSyntax or EqualsValueSyntax or AttributeListSyntax:
                    return true;

                case TypeBlockSyntax or EnumBlockSyntax:
                    return false;
            }
        }

        return false;
    }
}
