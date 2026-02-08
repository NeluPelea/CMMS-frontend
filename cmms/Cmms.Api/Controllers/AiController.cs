using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Cmms.Api.Ai.Tools;
using Cmms.Api.Services;

namespace Cmms.Api.Controllers;

// DTOs
public record AiChatRequestDto(
    string Message,
    string? AssetId = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null
);

public record AiChatResponseDto(string Answer);

[ApiController]
[Route("api/ai")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly ILogger<AiController> _logger;
    private readonly AiToolService _toolService;
    private readonly IGroqClient _groqClient;

    public AiController(
        ILogger<AiController> logger,
        AiToolService toolService,
        IGroqClient groqClient)
    {
        _logger = logger;
        _toolService = toolService;
        _groqClient = groqClient;
    }

    [HttpPost("chat")]
    public async Task<ActionResult<AiChatResponseDto>> Chat([FromBody] AiChatRequestDto request, CancellationToken ct = default)
    {
        var correlationId = Guid.NewGuid().ToString("N")[..8];
        
        try
        {
            // Validate
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { error = "Message is required" });
            }

            _logger.LogInformation("[{CorrelationId}] AI chat request received", correlationId);

            // Call Groq with tool calling support
            var answer = await _groqClient.ChatWithToolsAsync(request.Message, _toolService, ct);

            _logger.LogInformation("[{CorrelationId}] AI chat completed successfully", correlationId);

            return Ok(new AiChatResponseDto(answer));
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("GROQ_API_KEY"))
        {
            _logger.LogError("[{CorrelationId}] GROQ_API_KEY not configured", correlationId);
            return StatusCode(500, new { error = "GROQ_API_KEY not configured. Set Groq:ApiKey in appsettings or GROQ_API_KEY environment variable." });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "[{CorrelationId}] AI provider error", correlationId);
            return StatusCode(502, new { error = "AI provider error" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{CorrelationId}] Unexpected error in AI chat", correlationId);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /*
     * SMOKE TEST CASES (manual testing):
     * 
     * TEST 1: "istoricul mentenantei pe astazi pentru utilajul Cutata R8"
     * Expected tool calls:
     *   1. findAssets(query="Cutata R8")
     *   2. getTodayMaintenanceByAssetName(assetName="Cutata R8")
     * Expected output:
     *   - Lists today's interventions for Cutata R8
     *   - If no interventions: "No maintenance today for Cutata R8"
     *   - If ambiguous: "Multiple assets found, please clarify: ..."
     * 
     * TEST 2: "ce piese sunt sub stoc minim?"
     * Expected tool calls:
     *   1. getLowStockParts()
     * Expected output:
     *   - Lists parts below minimum stock with deficit quantities
     *   - If none: "All parts are adequately stocked"
     * 
     * TEST 3: "top piese consumate pe Cutata R8 in ultimele 30 zile"
     * Expected tool calls:
     *   1. findAssets(query="Cutata R8")
     *   2. getPartsUsedForAsset(assetId="...", fromUtc="...", toUtc="...")
     * Expected output:
     *   - Lists parts with quantities consumed in last 30 days
     *   - Sorted by quantity descending
     *   - If no parts used: "No parts consumed for Cutata R8 in the last 30 days"
     * 
     * TEST 4: "care sunt work order-urile deschise?"
     * Expected tool calls:
     *   1. getOpenWorkOrders()
     * Expected output:
     *   - Lists open and in-progress work orders with status, asset, created date
     * 
     * TEST 5: "calculeaza MTTR si MTBF pentru utilajul X in ultimele 90 zile"
     * Expected tool calls:
     *   1. findAssets(query="X")
     *   2. getAssetKpis(assetId="...", days=90)
     * Expected output:
     *   - MTTR value with explanation (average repair time)
     *   - MTBF value with explanation (average time between failures)
     *   - Failure count
     *   - Downtime hours
     *   - Repeated failure signals if detected
     */
}
