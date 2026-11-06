using System.Text.Json;
using System.Text.Json.Serialization;

namespace Atlas.Analyzer.Model;

/// <summary>JSON settings shared by the analyzer and documented for the extension.</summary>
public static class AtlasJson
{
    /// <summary>camelCase property names and lower camelCase enum values (<c>"interface"</c>, <c>"implements"</c>).</summary>
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };
}
