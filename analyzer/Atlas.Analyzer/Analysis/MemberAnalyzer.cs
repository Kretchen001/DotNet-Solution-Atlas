using Atlas.Analyzer.Model;
using Microsoft.CodeAnalysis;

namespace Atlas.Analyzer.Analysis;

/// <summary>
/// Lists the members of a type with what each of them refers to, so the map can show
/// "Order.Confirm calls PriceCalculator.Sum" and not only "Order depends on PriceCalculator".
/// </summary>
internal static class MemberAnalyzer
{
    /// <summary>A member that refers to hundreds of places is cut off; the rest is not what one reads.</summary>
    private const int MaxReferences = 60;

    /// <summary>The name of a member without its containing type: <c>Confirm(Order)</c>, <c>Total</c>.</summary>
    private static readonly SymbolDisplayFormat MemberFormat = new(
        genericsOptions: SymbolDisplayGenericsOptions.IncludeTypeParameters,
        memberOptions: SymbolDisplayMemberOptions.IncludeParameters,
        parameterOptions: SymbolDisplayParameterOptions.IncludeType,
        miscellaneousOptions: SymbolDisplayMiscellaneousOptions.UseSpecialTypes);

    public static List<AtlasMember> Collect(
        INamedTypeSymbol type,
        Compilation compilation,
        IReadOnlySet<string> knownTypes,
        CancellationToken ct = default)
    {
        var result = new List<AtlasMember>();
        var ownId = SymbolIds.For(type);

        foreach (var member in type.GetMembers())
        {
            if (member.IsImplicitlyDeclared || KindOf(member) is not { } kind)
            {
                continue;
            }

            if (member.DeclaringSyntaxReferences.FirstOrDefault() is not { } reference)
            {
                continue;
            }

            var declaration = reference.GetSyntax(ct);
            var span = declaration.GetLocation().GetLineSpan();

            var refs = DependencyCollector.SignatureTargets(member)
                .Select(target => new Reference(target, EdgeKind.Uses))
                .Concat(BodyDependencyCollector.CollectMember(declaration, compilation, ct))
                .Where(r => knownTypes.Contains(r.Target) && (r.Target != ownId || r.Member is not null))
                .Distinct()
                .OrderBy(r => r.Target, StringComparer.Ordinal)
                .ThenBy(r => r.Member, StringComparer.Ordinal)
                .ThenBy(r => r.Kind)
                .Take(MaxReferences)
                .Select(r => new AtlasMemberRef(r.Target, r.Member, r.Kind))
                .ToList();

            result.Add(new AtlasMember(
                member.ToDisplayString(MemberFormat),
                kind,
                span.Path,
                span.StartLinePosition.Line + 1,
                refs));
        }

        return result.OrderBy(m => m.Line).ThenBy(m => m.Name, StringComparer.Ordinal).ToList();
    }

    /// <summary>The kind shown for a member, or null for what is not listed: accessors, enum constants, nested types.</summary>
    private static string? KindOf(ISymbol member) => member switch
    {
        IMethodSymbol { AssociatedSymbol: not null } => null,
        IMethodSymbol { MethodKind: MethodKind.Constructor } => "constructor",
        IMethodSymbol { MethodKind: MethodKind.StaticConstructor } => "static constructor",
        IMethodSymbol { MethodKind: MethodKind.Destructor } => "destructor",
        IMethodSymbol { MethodKind: MethodKind.UserDefinedOperator } => "operator",
        IMethodSymbol { MethodKind: MethodKind.Conversion } => "conversion",
        IMethodSymbol { MethodKind: MethodKind.Ordinary or MethodKind.ExplicitInterfaceImplementation } => "method",
        IPropertySymbol { IsIndexer: true } => "indexer",
        IPropertySymbol => "property",
        IFieldSymbol { ContainingType.TypeKind: TypeKind.Enum } => null,
        IFieldSymbol { IsConst: true } => "constant",
        IFieldSymbol => "field",
        IEventSymbol => "event",
        _ => null,
    };
}
