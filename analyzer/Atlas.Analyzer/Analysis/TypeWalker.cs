using Microsoft.CodeAnalysis;

namespace Atlas.Analyzer.Analysis;

/// <summary>Enumerates the types of an assembly that are worth showing on the map.</summary>
internal static class TypeWalker
{
    public static IEnumerable<INamedTypeSymbol> GetTypes(INamespaceSymbol ns)
    {
        foreach (var member in ns.GetMembers())
        {
            switch (member)
            {
                case INamespaceSymbol child:
                    foreach (var type in GetTypes(child))
                    {
                        yield return type;
                    }

                    break;

                case INamedTypeSymbol type:
                    foreach (var found in WithNested(type))
                    {
                        yield return found;
                    }

                    break;
            }
        }
    }

    private static IEnumerable<INamedTypeSymbol> WithNested(INamedTypeSymbol type)
    {
        if (!IsRelevant(type))
        {
            yield break;
        }

        yield return type;

        foreach (var nested in type.GetTypeMembers())
        {
            foreach (var found in WithNested(nested))
            {
                yield return found;
            }
        }
    }

    /// <summary>
    /// Only types written by the developer count: no compiler-generated types,
    /// no delegates, nothing without a declaration in source.
    /// </summary>
    private static bool IsRelevant(INamedTypeSymbol type) =>
        !type.IsImplicitlyDeclared
        && !type.IsAnonymousType
        && !type.Name.StartsWith('<')
        && (type.TypeKind is TypeKind.Class or TypeKind.Interface or TypeKind.Struct or TypeKind.Enum)
        && type.Locations.Any(l => l.IsInSource);
}
