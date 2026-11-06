using Microsoft.CodeAnalysis;

namespace Atlas.Analyzer.Analysis;

/// <summary>Enumerates the types of a project that are worth showing on the map.</summary>
internal static class TypeWalker
{
    public static IEnumerable<INamedTypeSymbol> GetTypes(Compilation compilation) =>
        GetTypes(compilation.Assembly.GlobalNamespace, compilation);

    private static IEnumerable<INamedTypeSymbol> GetTypes(INamespaceSymbol ns, Compilation compilation)
    {
        foreach (var member in ns.GetMembers())
        {
            switch (member)
            {
                case INamespaceSymbol child:
                    foreach (var type in GetTypes(child, compilation))
                    {
                        yield return type;
                    }

                    break;

                case INamedTypeSymbol type:
                    foreach (var found in WithNested(type, compilation))
                    {
                        yield return found;
                    }

                    break;
            }
        }
    }

    private static IEnumerable<INamedTypeSymbol> WithNested(INamedTypeSymbol type, Compilation compilation)
    {
        if (!IsRelevant(type, compilation))
        {
            yield break;
        }

        yield return type;

        foreach (var nested in type.GetTypeMembers())
        {
            foreach (var found in WithNested(nested, compilation))
            {
                yield return found;
            }
        }
    }

    /// <summary>
    /// Only types written by the developer count: no compiler-generated types, no anonymous types,
    /// and nothing that is not declared in a file of the project. The last rule also excludes types
    /// that a compiler adds on its own, such as the "My" namespace of Visual Basic.
    /// A Visual Basic module is a static class.
    /// </summary>
    private static bool IsRelevant(INamedTypeSymbol type, Compilation compilation) =>
        !type.IsImplicitlyDeclared
        && !type.IsAnonymousType
        && !type.Name.StartsWith('<')
        && (type.TypeKind is TypeKind.Class or TypeKind.Interface or TypeKind.Struct or TypeKind.Enum
            or TypeKind.Delegate or TypeKind.Module)
        && type.Locations.Any(l => l.SourceTree is { } tree && compilation.ContainsSyntaxTree(tree));
}
