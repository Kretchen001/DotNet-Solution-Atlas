using Atlas.Analyzer.Model;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Atlas.Analyzer.Analysis;

/// <summary>
/// Finds what the code of a type refers to, which the signatures alone do not show:
/// <list type="bullet">
/// <item>calls of, and access to, members of other types, static or not
/// (<c>PriceCalculator.Total(order)</c>, <c>_repository.Save(order)</c>, extension methods): "calls"</item>
/// <item>types named in bodies, initializers and attributes
/// (<c>new Order()</c>, <c>typeof(Order)</c>, casts, locals, <c>Helper.Do()</c>): "uses"</item>
/// </list>
/// Like <see cref="DependencyCollector"/>, targets are reported per occurrence and the caller filters them.
/// </summary>
internal static class BodyDependencyCollector
{
    public static IEnumerable<(string Target, EdgeKind Kind)> Collect(
        INamedTypeSymbol type,
        Compilation compilation,
        CancellationToken ct = default)
    {
        foreach (var reference in type.DeclaringSyntaxReferences)
        {
            var root = reference.GetSyntax(ct);
            var model = compilation.GetSemanticModel(root.SyntaxTree);

            // Nested types are nodes of their own and are analyzed separately. The base
            // list is already covered by "inherits"/"implements".
            var names = root
                .DescendantNodes(node => ReferenceEquals(node, root) || node is not (BaseTypeDeclarationSyntax or BaseListSyntax))
                .OfType<SimpleNameSyntax>();

            foreach (var name in names)
            {
                var info = model.GetSymbolInfo(name, ct);
                var symbol = info.Symbol ?? info.CandidateSymbols.FirstOrDefault();

                switch (symbol)
                {
                    case INamedTypeSymbol named when IsInCode(name):
                        yield return (SymbolIds.For(named), EdgeKind.Uses);
                        break;

                    case IMethodSymbol method when method.MethodKind is MethodKind.Ordinary or MethodKind.ReducedExtension:
                        // For an extension method called like an instance method this is the static class.
                        if ((method.ReducedFrom ?? method).ContainingType is { } owner)
                        {
                            yield return (SymbolIds.For(owner), EdgeKind.Calls);
                        }

                        break;

                    // An enum member is a value of the enum, not a call.
                    case IFieldSymbol { ContainingType: { TypeKind: TypeKind.Enum } enumType }:
                        yield return (SymbolIds.For(enumType), EdgeKind.Uses);
                        break;

                    case IFieldSymbol or IPropertySymbol or IEventSymbol:
                        if (symbol.ContainingType is { } member)
                        {
                            yield return (SymbolIds.For(member), EdgeKind.Calls);
                        }

                        break;
                }
            }
        }
    }

    /// <summary>
    /// True for names inside executable code, initializers and attributes. Names in member
    /// signatures are not counted here, <see cref="DependencyCollector"/> already did that.
    /// </summary>
    private static bool IsInCode(SyntaxNode name)
    {
        foreach (var ancestor in name.Ancestors())
        {
            switch (ancestor)
            {
                case BlockSyntax or ArrowExpressionClauseSyntax or EqualsValueClauseSyntax
                    or ConstructorInitializerSyntax or AttributeListSyntax:
                    return true;

                case BaseTypeDeclarationSyntax:
                    return false;
            }
        }

        return false;
    }
}
