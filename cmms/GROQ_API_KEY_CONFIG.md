# Code Diffs: Configurable Groq API Key

## Modified Files

### 1. `Cmms.Api/Services/GroqClient.cs`

**Lines 19-30** - Updated API key resolution priority:

```diff
     public GroqClient(HttpClient httpClient, IConfiguration configuration, ILogger<GroqClient> logger)
     {
         _httpClient = httpClient;
         _logger = logger;
 
-        _apiKey = Environment.GetEnvironmentVariable("GROQ_API_KEY")
-            ?? throw new InvalidOperationException("GROQ_API_KEY environment variable is not set");
+        // Read API key: 1) IConfiguration, 2) Environment variable
+        _apiKey = configuration["Groq:ApiKey"]
+            ?? Environment.GetEnvironmentVariable("GROQ_API_KEY")
+            ?? throw new InvalidOperationException("GROQ_API_KEY not configured. Set Groq:ApiKey in appsettings or GROQ_API_KEY environment variable.");
 
         _model = configuration["Groq:Model"] ?? "llama-3.3-70b-versatile";
         
         var timeoutSeconds = configuration.GetValue<int?>("Groq:TimeoutSeconds") ?? 30;
         _httpClient.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
     }
```

**Change**: API key now checks `IConfiguration["Groq:ApiKey"]` first, then falls back to `GROQ_API_KEY` environment variable.

---

### 2. `Cmms.Api/Controllers/AiController.cs`

**Line 78** - Updated error message:

```diff
         catch (InvalidOperationException ex) when (ex.Message.Contains("GROQ_API_KEY"))
         {
             _logger.LogError("[{CorrelationId}] GROQ_API_KEY not configured", correlationId);
-            return StatusCode(500, new { error = "GROQ_API_KEY not configured" });
+            return StatusCode(500, new { error = "GROQ_API_KEY not configured. Set Groq:ApiKey in appsettings or GROQ_API_KEY environment variable." });
         }
```

**Change**: Error message now mentions both configuration sources.

---

## New Files

### 3. `Cmms.Api/appsettings.Development.json.example`

**New file** - Example configuration (not committed):

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=cmms_dev;Username=postgres;Password=your_password"
  },
  "Jwt": {
    "Key": "your-development-jwt-key-min-32-chars-long-for-security"
  },
  "Groq": {
    "ApiKey": "gsk_your_groq_api_key_here",
    "Model": "llama-3.3-70b-versatile",
    "TimeoutSeconds": 30
  }
}
```

**Usage**: 
1. Copy to `appsettings.Development.json`
2. Replace placeholder values
3. Ensure `appsettings.Development.json` is in `.gitignore`

---

## Configuration Priority

The Groq client now reads API key in this order:

1. **IConfiguration["Groq:ApiKey"]** (from `appsettings.json` or `appsettings.Development.json`)
2. **Environment variable `GROQ_API_KEY`**
3. **Throws exception** if neither is set

---

## Usage Examples

### Option 1: Using appsettings.Development.json (Recommended for development)

**appsettings.Development.json:**
```json
{
  "Groq": {
    "ApiKey": "gsk_your_actual_key_here"
  }
}
```

**Run:**
```powershell
dotnet run
# No need to set environment variable each time
```

---

### Option 2: Using Environment Variable (Recommended for production)

```powershell
# PowerShell
$env:GROQ_API_KEY = "gsk_your_key"
dotnet run

# Or add to system environment variables permanently
```

---

### Option 3: Using appsettings.json (Not recommended - committed to source control)

**Only use if:**
- Using a secrets manager in production
- Value is a reference/placeholder, not actual secret

**appsettings.json:**
```json
{
  "Groq": {
    "ApiKey": "#{GROQ_API_KEY}#"  // Placeholder for deployment
  }
}
```

---

## Security Notes

✅ **DO**: Use `appsettings.Development.json` for local development (ensure it's gitignored)  
✅ **DO**: Use environment variables in production  
❌ **DON'T**: Commit actual API keys to `appsettings.json`  
❌ **DON'T**: Hardcode secrets in source code  

---

## Build Status

```
✅ Build succeeded (0 errors)
```

---

## Testing

**Before (environment variable required):**
```powershell
# Had to set this every time
$env:GROQ_API_KEY = "gsk_..."
dotnet run
```

**After (persistent configuration):**
```powershell
# One-time setup
cp appsettings.Development.json.example appsettings.Development.json
# Edit appsettings.Development.json, add real key

# Run anytime
dotnet run
# API key loaded from config automatically
```

---

## Summary

- **2 files modified** (GroqClient.cs, AiController.cs)
- **1 file added** (appsettings.Development.json.example)
- **Priority**: IConfiguration → Environment → Exception
- **Build**: Successful ✅
