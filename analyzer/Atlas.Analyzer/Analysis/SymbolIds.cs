using System.Text;
using Microsoft.CodeAnalysis;

namespace Atlas.Analyzer.Analysis;

/// <summary>Stable, human-readable identifiers for types, the same in every language.</summary>
internal static class SymbolIds
{
    /// <summary>
    /// Namespace, containing types and name, with generic parameters in angle brackets:
    /// <c>Shop.Domain.Repository&lt;T&gt;</c>. Constructed generics map to their open definition,
    /// so <c>List&lt;Order&gt;</c> and <c>List&lt;Customer&gt;</c> are both <c>List&lt;T&gt;</c>.
    /// Built by hand because the display strings of Roslyn follow the syntax of the symbol's
    /// language (<c>Repository(Of T)</c> in Visual Basic), which would keep a type in a C# project
    /// and a reference to it from a VB project apart.
    /// </summary>
    public static string For(INamedTypeSymbol type)
    {
        var builder = new StringBuilder();
        Append(type.OriginalDefinition, builder);
        return builder.ToString();
    }

    private static void Append(INamedTypeSymbol type, StringBuilder builder)
    {
        if (type.ContainingType is { } outer)
        {
            Append(outer, builder);
            builder.Append('.');
        }
        else if (!type.ContainingNamespace.IsGlobalNamespace)
        {
            builder.Append(type.ContainingNamespace.ToDisplayString()).Append('.');
        }

        builder.Append(type.Name);

        if (type.TypeParameters.Length > 0)
        {
            builder.Append('<').AppendJoin(", ", type.TypeParameters.Select(p => p.Name)).Append('>');
        }
    }
}
