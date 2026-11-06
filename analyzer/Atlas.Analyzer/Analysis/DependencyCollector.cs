using Atlas.Analyzer.Model;
using Microsoft.CodeAnalysis;

namespace Atlas.Analyzer.Analysis;

/// <summary>
/// Finds the types a type depends on. Targets are reported for every occurrence,
/// so the caller can count them; filtering to types of the solution is up to the caller.
/// </summary>
internal static class DependencyCollector
{
    public static IEnumerable<(string Target, EdgeKind Kind)> Collect(INamedTypeSymbol type)
    {
        // Base type: the type itself is "inherits", its type arguments are "uses".
        // Example: class OrderRepo : Repository<Order> inherits Repository<T> and uses Order.
        if (type.BaseType is { } baseType)
        {
            yield return (SymbolIds.For(baseType), EdgeKind.Inherits);

            foreach (var target in Referenced(baseType.TypeArguments))
            {
                yield return (target, EdgeKind.Uses);
            }
        }

        // An interface that extends another interface inherits, a class implements.
        var interfaceEdge = type.TypeKind == TypeKind.Interface ? EdgeKind.Inherits : EdgeKind.Implements;

        foreach (var implemented in type.Interfaces)
        {
            yield return (SymbolIds.For(implemented), interfaceEdge);

            foreach (var target in Referenced(implemented.TypeArguments))
            {
                yield return (target, EdgeKind.Uses);
            }
        }

        foreach (var member in type.GetMembers())
        {
            if (member.IsImplicitlyDeclared)
            {
                continue;
            }

            foreach (var target in Referenced(TypesInSignature(member)))
            {
                yield return (target, EdgeKind.Uses);
            }
        }
    }

    private static IEnumerable<ITypeSymbol> TypesInSignature(ISymbol member)
    {
        switch (member)
        {
            case IFieldSymbol field:
                yield return field.Type;
                break;

            case IPropertySymbol property:
                yield return property.Type;
                foreach (var parameter in property.Parameters)
                {
                    yield return parameter.Type;
                }

                break;

            case IEventSymbol @event:
                yield return @event.Type;
                break;

            // Accessors belong to a property or event and were counted there.
            case IMethodSymbol { AssociatedSymbol: null } method:
                yield return method.ReturnType;
                foreach (var parameter in method.Parameters)
                {
                    yield return parameter.Type;
                }

                break;
        }
    }

    private static IEnumerable<string> Referenced(IEnumerable<ITypeSymbol> types) =>
        types.SelectMany(Named).Select(SymbolIds.For);

    /// <summary>Unwraps arrays, pointers and generic arguments: <c>Dictionary&lt;string, Order[]&gt;</c> yields Dictionary, string and Order.</summary>
    private static IEnumerable<INamedTypeSymbol> Named(ITypeSymbol? type)
    {
        switch (type)
        {
            case IArrayTypeSymbol array:
                foreach (var inner in Named(array.ElementType))
                {
                    yield return inner;
                }

                break;

            case IPointerTypeSymbol pointer:
                foreach (var inner in Named(pointer.PointedAtType))
                {
                    yield return inner;
                }

                break;

            case INamedTypeSymbol named:
                yield return named;

                foreach (var argument in named.TypeArguments)
                {
                    foreach (var inner in Named(argument))
                    {
                        yield return inner;
                    }
                }

                break;
        }
    }
}
