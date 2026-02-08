# Groq AI Integration - Implementation Summary

## Overview
Complete Groq AI integration for CMMS project with read-only, secure AI chat endpoint.

---

## Files Created

### Backend (C#)
1. **`Cmms.Api/Controllers/AiController.cs`**
   - DTOs: `AiChatRequestDto`, `AiChatResponseDto`
   - POST `/api/ai/chat` endpoint
   - Protected with `[Authorize]`
   - Error handling for GROQ_API_KEY and provider errors

2. **`Cmms.Api/Services/AiContextService.cs`**
   - Read-only service for asset context
   - Methods:
     - `GetAssetRecentWorkOrders(assetId, limit=20)`
     - `GetAssetTopPartsUsed(assetId, days=90, limit=10)`
     - `GetLowStockPartsForAsset(assetId)`
   - Compact DTOs with minimal data

3. **`Cmms.Api/Services/GroqClient.cs`**
   - HTTP client for Groq API
   - Interface: `IGroqClient`
   - Reads `GROQ_API_KEY` from environment
   - Model from `Groq:Model` config (default: `llama-3.3-70b-versatile`)
   - Timeout from `Groq:TimeoutSeconds` (default: 30s)

### Frontend (TypeScript/React)
4. **`cmms-frontend/src/api/ai.ts`**
   - `chatAi(request)` function using `apiFetch`
   - Types: `AiChatRequest`, `AiChatResponse`

5. **`cmms-frontend/src/pages/AiCopilotPage.tsx`**
   - AI chat UI with:
     - Message textarea
     - Optional Asset ID input
     - Optional date range inputs
     - Send button with loading state
     - Response display with formatting
     - Help tips section

---

## Files Modified

### Backend
1. **`Cmms.Api/Program.cs`** (Lines 72-79)
   - Registered `AiContextService` as scoped
   - Registered typed HttpClient for `IGroqClient`/`GroqClient`
   - BaseAddress: `https://api.groq.com/openai/v1/`

### Frontend
2. **`cmms-frontend/src/api/index.ts`**
   - Added `export * from "./ai";`

3. **`cmms-frontend/src/App.tsx`**
   - Added `AiCopilotPage` import
   - Added route `/ai-copilot` with RequireAuth

4. **`cmms-frontend/src/components/AppShell.tsx`**
   - Added navigation item: `{ to: "/ai-copilot", label: "AI Copilot" }`

---

## Configuration Required

### Environment Variable (MANDATORY)
```powershell
# Set GROQ_API_KEY
$env:GROQ_API_KEY = "your-groq-api-key-here"
```

### appsettings.json (OPTIONAL)
```json
{
  "Groq": {
    "Model": "llama-3.3-70b-versatile",
    "TimeoutSeconds": 30
  }
}
```

---

## How to Run

### 1. Set API Key
```powershell
# PowerShell
$env:GROQ_API_KEY = "gsk_..."

# Or add to system environment variables
```

### 2. Start Backend
```powershell
cd e:\CMMS\cmms\Cmms.Api
dotnet run
```

Backend runs on: `http://localhost:5026`

### 3. Start Frontend
```powershell
cd e:\CMMS\cmms\cmms-frontend
npm run dev
```

Frontend runs on: `http://localhost:5173`

### 4. Access AI Copilot
1. Login to app: `http://localhost:5173/login`
2. Navigate to **AI Copilot** in sidebar
3. Or go directly to: `http://localhost:5173/ai-copilot`

---

## Usage Example

### Basic Query
**Message**: "What maintenance tips can you provide?"
**Response**: AI provides general maintenance recommendations

### Asset-Specific Query
**Message**: "What are the common issues with this asset?"
**Asset ID**: `<guid-of-asset>`
**Response**: AI analyzes:
- Recent work orders (last 20)
- Top parts used (last 90 days, top 10)
- Low stock parts for that asset
- Provides insights and recommendations

---

## Security Features

✅ **Endpoint Protection**: `[Authorize]` attribute on `/api/ai/chat`
✅ **JWT Authentication**: Uses existing Bearer token from localStorage
✅ **Read-Only**: No database writes, only SELECT queries  
✅ **Environment-based API Key**: Never hardcoded
✅ **Error Handling**: 
   - Returns 500 if `GROQ_API_KEY` missing
   - Returns 502 on Groq API errors (doesn't leak details)
✅ **Logging**: Only correlation IDs and status (no secrets/prompts)

---

## API Endpoints

### POST `/api/ai/chat`
**Headers**:
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "message": "What maintenance should I prioritize?",
  "assetId": "optional-asset-guid",
  "fromUtc": "optional-datetime",
  "toUtc": "optional-datetime"
}
```

**Response** (200 OK):
```json
{
  "answer": "Based on the asset data:\n- Prioritize preventive maintenance for...\n- Check parts inventory levels\n- Schedule inspection for..."
}
```

**Error Responses**:
- `400`: Message is required
- `500`: GROQ_API_KEY not configured
- `502`: AI provider error

---

## System Prompt (Enforced by Backend)

```
You are a maintenance assistant for a CMMS system. Follow these rules strictly:
- Provide concise, structured bullet points
- Never invent data - only use provided context
- If data is missing, explicitly state what information is unavailable
- Provide recommendations only, never execute actions
- Format: Use clear bullet points with relevant metrics
- Focus on actionable insights for maintenance planning
```

---

## Build Status

✅ **Backend**: Build successful (0 errors)
✅ **Frontend**: Pending verification

---

## Testing Checklist

### Backend Tests
- [ ] `dotnet build` succeeds
- [ ] `dotnet run` starts without errors
- [ ] API accessible at `http://localhost:5026/swagger`
- [ ] Endpoint appears in Swagger: `POST /api/ai/chat`
- [ ] Without `GROQ_API_KEY`: returns 500 error
- [ ] With `GROQ_API_KEY`: accepts requests

### Frontend Tests
- [ ] `npm run dev` starts without errors
- [ ] Can login to app
- [ ] "AI Copilot" appears in sidebar navigation
- [ ] `/ai-copilot` page loads
- [ ] Form inputs work (message, asset ID, dates)
- [ ] Send button disabled when message empty
- [ ] Loading state shows when request in progress
- [ ] Response displays in formatted box
- [ ] Error messages show for API failures

### Integration Tests
- [ ] Send basic message → receives AI response
- [ ] Send message with asset ID → receives context-aware response
- [ ] Invalid asset ID → handles gracefully
- [ ] Network error → shows error message
- [ ] Unauthorized (no token) → redirects to login

---

## Limitations & Notes

1. **Read-Only**: AI assistant cannot create/update/delete data
2. **Context Window**: Limited to last 20 WOs, 10 parts, etc.
3. **Rate Limits**: Subject to Groq API rate limits
4. **No Streaming**: Responses are returned in full (not streamed)
5. **No Conversation Memory**: Each request is independent
6. **Asset Context Only**: Currently only supports asset-specific context

---

## Future Enhancements (Not Implemented)

- [ ] Conversation history / memory
- [ ] Streaming responses
- [ ] Support for people/location context
- [ ] File upload for maintenance manuals
- [ ] Voice input
- [ ] Multi-language support
- [ ] Rate limiting on backend
- [ ] Response caching
- [ ] Analytics/usage tracking

---

## Troubleshooting

### "GROQ_API_KEY not configured"
**Solution**: Set environment variable before starting backend
```powershell
$env:GROQ_API_KEY = "your-key"
dotnet run
```

### "AI provider error" (502)
**Causes**:
- Groq API is down
- Network connectivity issues
- Invalid API key
- Rate limit exceeded

**Solution**: Check Groq API status, verify API key

### "Message is required" (400)
**Cause**: Empty message field  
**Solution**: Enter a message before clicking Send

### UI shows "Failed to get AI response"
**Causes**:
- Backend not running
- Not logged in (JWT missing/expired)
- Network error

**Solution**: 
1. Check backend is running
2. Re-login to refresh JWT
3. Check browser console for errors

---

## Code Quality

- No breaking changes to existing code
- Follows existing project conventions
- TypeScript types defined
- Error handling comprehensive
- Logging implemented (correlation IDs)
- Build successful (0 errors)

---

**Status**: ✅ **READY FOR TESTING**
