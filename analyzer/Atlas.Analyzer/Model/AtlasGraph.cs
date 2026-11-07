namespace Atlas.Analyzer.Model;

/// <summary>The kind of a type shown as a node in the map.</summary>
public enum NodeKind
{
    Class,
    Interface,
    Struct,
    Record,
    Enum,
    Delegate,
}

/// <summary>How two types are related. The edge points from the dependent to the dependency.</summary>
public enum EdgeKind
{
    /// <summary>The source derives from the target (class or interface inheritance).</summary>
    Inherits,

    /// <summary>The source class or struct implements the target interface.</summary>
    Implements,

    /// <summary>
    /// The source references the target in a signature (field, property, event, method) or names it in
    /// code (<c>new</c>, <c>typeof</c>, casts, locals, attributes).
    /// </summary>
    Uses,

    /// <summary>
    /// The source calls a method, constructor or operator of the target, or invokes a delegate of that
    /// type. Static and instance members count alike, so calls of static helper classes show up as well.
    /// </summary>
    Calls,

    /// <summary>
    /// The source reads or writes a property, indexer, field or event of the target.
    /// Enum members count as well.
    /// </summary>
    Accesses,

    /// <summary>
    /// The source registers the target with the dependency injection container
    /// (<c>services.AddScoped&lt;IOrders, Orders&gt;()</c>, <c>AddHostedService&lt;Worker&gt;()</c>, ...).
    /// The code that uses the container never names the implementation; this is where it is chosen.
    /// </summary>
    Registers,

    /// <summary>The source subscribes to, unsubscribes from or raises an event of the target.</summary>
    Events,

    /// <summary>The source is marked with the target, an attribute class of the solution.</summary>
    Annotated,
}

/// <summary>What a member refers to: a member of another type (calls, accesses) or a type as a whole (uses).</summary>
/// <param name="Target">Id of the type that is referred to.</param>
/// <param name="Member">Name of the called or accessed member, empty if only the type is used.</param>
/// <param name="Kind">Never <see cref="EdgeKind.Inherits"/> or <see cref="EdgeKind.Implements"/>: those belong to the type.</param>
public sealed record AtlasMemberRef(string Target, string? Member, EdgeKind Kind);

/// <summary>A member of a type with the places in the solution it refers to.</summary>
/// <param name="Name">Display name without the containing type, e.g. <c>Confirm(Order)</c>.</param>
/// <param name="Kind"><c>method</c>, <c>constructor</c>, <c>property</c>, <c>field</c>, <c>event</c>, <c>operator</c>, ...</param>
/// <param name="File">Absolute path of the declaring file.</param>
/// <param name="Line">1-based line of the declaration.</param>
public sealed record AtlasMember(string Name, string Kind, string? File, int? Line, IReadOnlyList<AtlasMemberRef> Refs);

/// <summary>A type that is declared in source code of the analyzed solution.</summary>
/// <param name="Id">Fully qualified, unique name, e.g. <c>Shop.Domain.Order</c>.</param>
/// <param name="Name">Short display name including generic parameters.</param>
/// <param name="Namespace">Containing namespace, empty for the global namespace.</param>
/// <param name="Project">Name of the project that declares the type.</param>
/// <param name="File">Absolute path of the first declaring file.</param>
/// <param name="Line">1-based line of the declaration in <paramref name="File"/>.</param>
/// <param name="Members">Number of explicitly declared members.</param>
/// <param name="Methods">Number of explicitly declared methods (without accessors).</param>
/// <param name="Lines">Total number of lines of all declarations.</param>
/// <param name="IsStatic">True for static classes and Visual Basic modules.</param>
/// <param name="Language">Language of the declaring project: <c>csharp</c> or <c>visualbasic</c>.</param>
/// <param name="MemberDetails">The members with what each of them refers to; null for a type without members to show.</param>
public sealed record AtlasNode(
    string Id,
    string Name,
    NodeKind Kind,
    string Namespace,
    string Project,
    string? File,
    int? Line,
    int Members,
    int Methods,
    int Lines,
    bool IsStatic,
    string Language,
    IReadOnlyList<AtlasMember>? MemberDetails = null);

/// <param name="Source">Id of the dependent type.</param>
/// <param name="Target">Id of the type it depends on.</param>
/// <param name="Weight">How often the relationship occurs, e.g. number of signatures using the target.</param>
public sealed record AtlasEdge(string Source, string Target, EdgeKind Kind, int Weight);

/// <summary>The complete result of an analysis run.</summary>
/// <param name="Root">The solution or project file that was analyzed.</param>
public sealed record AtlasGraph(
    string Root,
    IReadOnlyList<AtlasNode> Nodes,
    IReadOnlyList<AtlasEdge> Edges);
