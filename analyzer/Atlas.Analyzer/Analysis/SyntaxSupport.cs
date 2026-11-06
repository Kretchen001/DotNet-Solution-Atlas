using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.Operations;

namespace Atlas.Analyzer.Analysis;

/// <summary>
/// The language-specific part of the code analysis: which syntax nodes make up the code of a type,
/// where operation trees start, and how names and attributes are resolved. Everything else is
/// shared, because symbols and operations are the same for all languages.
/// </summary>
internal interface ISyntaxSupport
{
    /// <summary>
    /// The node that contains a whole type declaration including its body. A symbol points at the
    /// declaration; in some languages that is only the header line.
    /// </summary>
    SyntaxNode BodyRoot(SyntaxNode declaration);

    /// <summary>The nodes of <paramref name="root"/> that belong to the type itself: nested types and base lists are left out.</summary>
    IEnumerable<SyntaxNode> Nodes(SyntaxNode root);

    /// <summary>The type a name in code refers to, or the class of an attribute. Null for every other node.</summary>
    INamedTypeSymbol? ReferencedType(SyntaxNode node, SemanticModel model, CancellationToken ct);

    /// <summary>The node from which an operation tree is taken, or null if the node is not the start of one.</summary>
    SyntaxNode? OperationRoot(SyntaxNode node);

    /// <summary>True if the local was declared without a type, so its type is inferred.</summary>
    bool IsInferredLocal(IVariableDeclaratorOperation declarator);

    /// <summary>True for an object creation that does not name its type (C# <c>new()</c>).</summary>
    bool IsImplicitCreation(IObjectCreationOperation creation);

    /// <summary>The methods and properties a foreach loop uses implicitly.</summary>
    ForEachStatementInfo? ForEachInfo(IForEachLoopOperation loop, SemanticModel model);
}

internal static class SyntaxSupport
{
    /// <summary>Returns the support for a language (<see cref="LanguageNames"/>), or null if it is not analyzed.</summary>
    public static ISyntaxSupport? For(string language) => language switch
    {
        LanguageNames.CSharp => CSharpSyntaxSupport.Instance,
        LanguageNames.VisualBasic => VisualBasicSyntaxSupport.Instance,
        _ => null,
    };
}
