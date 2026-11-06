using Microsoft.CodeAnalysis;

namespace Atlas.Analyzer.Analysis;

/// <summary>Stable, human-readable identifiers for types.</summary>
internal static class SymbolIds
{
    private static readonly SymbolDisplayFormat Format = new(
        typeQualificationStyle: SymbolDisplayTypeQualificationStyle.NameAndContainingTypesAndNamespaces,
        genericsOptions: SymbolDisplayGenericsOptions.IncludeTypeParameters);

    /// <summary>
    /// Constructed generics map to their open definition, so <c>List&lt;Order&gt;</c>
    /// and <c>List&lt;Customer&gt;</c> are both <c>List&lt;T&gt;</c>.
    /// </summary>
    public static string For(INamedTypeSymbol type) => type.OriginalDefinition.ToDisplayString(Format);
}
