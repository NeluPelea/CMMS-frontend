using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Cmms.Api.Ai.Tools;

namespace Cmms.Api.Services;

public interface IGroqClient
{
    Task<string> ChatWithToolsAsync(string userMessage, AiToolService toolService, CancellationToken ct = default);
}

public class GroqClient : IGroqClient
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly ILogger<GroqClient> _logger;

    // Orchestration limits
    private const int MaxIterations = 10; // Increased to 10 as requested (was 5 but hit limit)
    private const int MaxToolCallsPerIteration = 5; // Allow more tools per iteration
    private const int MaxContextBytes = 250_000;

    public GroqClient(HttpClient httpClient, IConfiguration configuration, ILogger<GroqClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        // Read API key: 1) IConfiguration, 2) Environment variable
        _apiKey = configuration["Groq:ApiKey"]
            ?? Environment.GetEnvironmentVariable("GROQ_API_KEY")
            ?? throw new InvalidOperationException("GROQ_API_KEY not configured. Set Groq:ApiKey in appsettings or GROQ_API_KEY environment variable.");

        _model = configuration["Groq:Model"] ?? "llama-3.3-70b-versatile";
        
        var timeoutSeconds = configuration.GetValue<int?>("Groq:TimeoutSeconds") ?? 45; // Increased for tool calls
        _httpClient.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
    }

    public async Task<string> ChatWithToolsAsync(string userMessage, AiToolService toolService, CancellationToken ct = default)
    {
        var messages = new List<object>
        {
            new
            {
                role = "system",
                content = @"You are a maintenance assistant for a CMMS system with direct database access via tools.

STRICT RULES:
- You have database access ONLY through the tools provided below
- NEVER say you don't have database access - you DO via tools
- If you need data, ALWAYS call the appropriate tool first
- Do NOT invent maintenance records, parts, or events - only use tool results
- If a tool returns no results, say so explicitly
- If asset name is ambiguous, ask user to choose from the matches found
- Provide concise, bullet-point answers based on actual data
- For KPIs (MTTR, MTBF), explain what the calculated values mean
- You can recommend actions but CANNOT execute changes (read-only system)

TOOL USAGE GUIDANCE:
- For 'today's maintenance for asset X': Use getTodayMaintenanceByAssetName(assetName='X') - it handles everything
- For 'low stock parts': Use getLowStockParts() directly
- For 'open work orders': Use getOpenWorkOrders() directly
- For parts usage: First findAssets, then getPartsUsedForAsset
- For KPIs: First findAssets, then getAssetKpis

ONCE YOU GET DATA FROM A TOOL, ANSWER THE USER - don't call more tools unless needed!"
            }
        };

        messages.Add(new { role = "user", content = userMessage });

        var tools = AiToolService.GetToolDefinitions();
        var iteration = 0;

        while (iteration < MaxIterations)
        {
            iteration++;
            _logger.LogInformation("[AI-Copilot] Tool calling iteration {Iteration}/{Max}, Messages: {Count}", iteration, MaxIterations, messages.Count);

            // Truncate if too large
            var contextSize = EstimateSize(messages);
            if (contextSize > MaxContextBytes)
            {
                _logger.LogWarning("Context too large ({Size} bytes), truncating early messages", contextSize);
                messages = TruncateMessages(messages);
            }

            var response = await CallGroqAsync(messages, tools, ct);

            var choice = response.Choices?.FirstOrDefault();
            if (choice == null)
                return "No response from AI";

            var message = choice.Message;

            // If no tool calls, return final answer
            if (message?.ToolCalls == null || message.ToolCalls.Count == 0)
            {
                return message?.Content ?? "No answer provided";
            }

            // Execute tool calls
            _logger.LogInformation("Executing {Count} tool calls", message.ToolCalls.Count);
            
            // Add assistant message with tool calls
            messages.Add(new
            {
                role = "assistant",
                content = message.Content,
                tool_calls = message.ToolCalls.Take(MaxToolCallsPerIteration).Select(tc => new
                {
                    id = tc.Id,
                    type = tc.Type,
                    function = new
                    {
                        name = tc.Function?.Name,
                        arguments = tc.Function?.Arguments
                    }
                }).ToList()
            });

            // Execute tools and add results
            var toolCallsToProcess = message.ToolCalls.Take(MaxToolCallsPerIteration).ToList();
            foreach (var toolCall in toolCallsToProcess)
            {
                var toolName = toolCall.Function?.Name ?? "unknown";
                var toolArgs = toolCall.Function?.Arguments ?? "{}";

                try
                {
                    var result = await toolService.ExecuteToolAsync(toolName, toolArgs);
                    var resultJson = JsonSerializer.Serialize(result);

                    messages.Add(new
                    {
                        role = "tool",
                        tool_call_id = toolCall.Id,
                        name = toolName,
                        content = resultJson
                    });

                    _logger.LogInformation("Tool {Tool} executed successfully", toolName);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Tool {Tool} failed", toolName);
                    messages.Add(new
                    {
                        role = "tool",
                        tool_call_id = toolCall.Id,
                        name = toolName,
                        content = $"{{\"error\": \"{ex.Message}\"}}"
                    });
                }
            }
        }

        return "Maximum iterations reached. Please simplify your question.";
    }

    private async Task<GroqChatResponse> CallGroqAsync(List<object> messages, List<object> tools, CancellationToken ct)
    {
        var requestBody = new
        {
            model = _model,
            messages,
            tools,
            tool_choice = "auto",
            temperature = 0.0, // Set to 0 for deterministic tool usage
            max_tokens = 2048
        };

        var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        });

        using var request = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };

        request.Headers.Add("Authorization", $"Bearer {_apiKey}");

        var response = await _httpClient.SendAsync(request, ct);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Groq API error: {StatusCode}, {Content}", response.StatusCode, errorContent);
            throw new HttpRequestException($"Groq API returned {response.StatusCode}");
        }

        var responseContent = await response.Content.ReadAsStringAsync(ct);
        var groqResponse = JsonSerializer.Deserialize<GroqChatResponse>(responseContent, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        return groqResponse ?? new GroqChatResponse();
    }

    private int EstimateSize(List<object> messages)
    {
        var json = JsonSerializer.Serialize(messages);
        return Encoding.UTF8.GetByteCount(json);
    }

    private List<object> TruncateMessages(List<object> messages)
    {
        // ALWAYS keep system message (0) and user message (1)
        if (messages.Count <= 12)
            return messages;

        var preserved = new List<object> { messages[0], messages[1] };
        // Skip first two and take the last 10
        preserved.AddRange(messages.Skip(messages.Count - 10));
        return preserved;
    }
}

// Response DTOs for Groq API with tool calling support
internal class GroqChatResponse
{
    [JsonPropertyName("choices")]
    public List<GroqChoice>? Choices { get; set; }
}

internal class GroqChoice
{
    [JsonPropertyName("message")]
    public GroqMessage? Message { get; set; }
}

internal class GroqMessage
{
    [JsonPropertyName("content")]
    public string? Content { get; set; }

    [JsonPropertyName("tool_calls")]
    public List<GroqToolCall>? ToolCalls { get; set; }
}

internal class GroqToolCall
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("function")]
    public GroqFunctionCall? Function { get; set; }
}

internal class GroqFunctionCall
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("arguments")]
    public string? Arguments { get; set; }
}
