# Quick Reference: Groq AI Integration

## 🚀 How to Run

### PowerShell Commands
```powershell
# 1. Set API Key (REQUIRED)
$env:GROQ_API_KEY = "gsk_your_groq_api_key_here"

# 2. Start Backend
cd e:\CMMS\cmms\Cmms.Api
dotnet run

# 3. Start Frontend (new terminal)
cd e:\CMMS\cmms\cmms-frontend
npm run dev

# 4. Open Browser
# http://localhost:5173/ai-copilot
```

---

## 📁 Files Created

**Backend:**
- `Cmms.Api/Controllers/AiController.cs` - API endpoint
- `Cmms.Api/Services/AiContextService.cs` - Read-only DB context
- `Cmms.Api/Services/GroqClient.cs` - Groq HTTP client

**Frontend:**
- `cmms-frontend/src/api/ai.ts` - API client
- `cmms-frontend/src/pages/AiCopilotPage.tsx` - UI page

---

## 📝 Configuration

### Environment Variable (Required)
```powershell
$env:GROQ_API_KEY = "your-key"
```

### appsettings.json (Optional)
```json
{
  "Groq": {
    "Model": "llama-3.3-70b-versatile",
    "TimeoutSeconds": 30
  }
}
```

---

## 🔧 API Endpoint

**POST** `/api/ai/chat`

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request:**
```json
{
  "message": "What maintenance should I prioritize?",
  "assetId": "optional-guid",
  "fromUtc": "optional-iso-datetime",
  "toUtc": "optional-iso-datetime"
}
```

**Response:**
```json
{
  "answer": "AI response here..."
}
```

---

## ✅ Build Status

```
Backend:  ✅ SUCCESS (0 errors)
Frontend: ✅ SUCCESS (built in 1.70s)
```

---

## 🔒 Security

- ✅ Protected with `[Authorize]`
- ✅ JWT Bearer authentication
- ✅ Read-only database access
- ✅ API key from environment only
- ✅ No secrets in code/logs

---

## 📖 Full Documentation

See `GROQ_AI_INTEGRATION.md` for:
- Detailed architecture
- Testing checklist
- Troubleshooting guide
- Future enhancements

---

## ⚡ Quick Test

1. **Get Groq API key**: https://console.groq.com
2. **Set env var**: `$env:GROQ_API_KEY = "gsk_..."`
3. **Run backend**: `dotnet run` in Cmms.Api folder
4. **Run frontend**: `npm run dev` in cmms-frontend folder
5. **Login**: http://localhost:5173/login
6. **Test AI**: Click "AI Copilot" in sidebar
7. **Send message**: "What are common maintenance tasks?"

---

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| "GROQ_API_KEY not configured" | Set `$env:GROQ_API_KEY` before `dotnet run` |
| "AI provider error" | Check Groq API status, verify key |
| 401 Unauthorized | Login again to refresh JWT |
| Page not found | Verify frontend route `/ai-copilot` exists |

---

**Status**: ✅ READY TO USE

For detailed info, see: `GROQ_AI_INTEGRATION.md`
