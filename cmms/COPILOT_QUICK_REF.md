# CMMS Copilot - Quick Reference

## ✅ BUILD STATUS: SUCCESS

```
Backend:  ✅ 0 Errors
Frontend: ✅ Already exists
```

---

## 🚀 Quick Start

```powershell
# 1. Set API key (choose one option)
## Option A: appsettings.Development.json
{ "Groq": { "ApiKey": "gsk_your_key_here" } }

## Option B: Environment variable
$env:GROQ_API_KEY = "gsk_your_key_here"

# 2. Run backend
cd e:\CMMS\cmms\Cmms.Api
dotnet run

# 3. Run frontend (new terminal)
cd e:\CMMS\cmms\cmms-frontend
npm run dev

# 4. Test
# http://localhost:5173/ai-copilot
```

---

## 🎯 Test Questions

### Romanian (Recommended)
1. `"ce piese sunt sub stoc minim?"`
2. `"istoricul mentenantei pe astazi pentru utilajul Cutata R8"`
3. `"top piese consumate pe Cutata R8 in ultimele 30 zile"`
4. `"care sunt work order-urile deschise?"`
5. `"calculeaza MTTR si MTBF pentru Cutata R8"`

### English
1. `"which parts are below minimum stock?"`
2. `"today's maintenance for asset Cutata R8"`
3. `"top parts consumed by Cutata R8 in last 30 days"`
4. `"what are the open work orders?"`
5. `"calculate MTTR and MTBF for Cutata R8"`

---

## 🛠️ 10 Available Tools

| Tool | Purpose | Key Input |
|------|---------|-----------|
| `findAssets` | Search assets | asset name/code |
| `getAssetDetails` | Asset info | assetId (GUID) |
| `getMaintenanceHistory` | WO history | assetId + date range |
| `getTodayMaintenanceByAssetName` | Today's work | asset name |
| `getOpenWorkOrders` | Open WOs | optional filters |
| `getOverdueWorkOrders` | Overdue WOs | optional nowUtc |
| `getPartStock` | Part inventory | part name |
| `getLowStockParts` | Below min stock | (no input) |
| `getPartsUsedForAsset` | Parts usage | assetId + dates |
| `getAssetKpis` | Calculate KPIs | assetId + days |

---

## 📁 Files Changed

### Created
- `Cmms.Api/Ai/Tools/AiToolService.cs` (638 lines)

### Modified
- `Cmms.Api/Services/GroqClient.cs` (tool calling loop)
- `Cmms.Api/Controllers/AiController.cs` (removed static context)
- `Cmms.Api/Program.cs` (+1 line: AiToolService registration)

---

## 🔒 Security

✅ JWT required  
✅ READ-ONLY (no DB writes)  
✅ No secrets in code  
✅ Context & iteration limits  
✅ Error handling  

---

## 🐛 Quick Debug

### Check if tools are being called
```powershell
# Watch backend logs - should see:
[INFO] Executing tool: findAssets
[INFO] Executing tool: getMaintenanceHistory
```

### Check tool results
- Tool results are sent back to Groq
- Final answer should reference actual data
- If AI says "no access" → something wrong with system prompt

### Common Issues
| Issue | Fix |
|-------|-----|
| API key error | Set Groq:ApiKey or GROQ_API_KEY |
| "No asset found" | Typo in asset name |
| Empty results | No data in DB for query period |
| 502 error | Groq API issue (check status) |

---

## 📊 What Changed from Before

**BEFORE**: Copilot had static context (limited to asset-specific data)
- Could only answer if you provided assetId upfront
- Said "I have no database access" for general questions
- Limited to pre-fetched data

**AFTER**: Copilot has dynamic tool calling
- Can search for assets by name
- Can answer general questions ("what's overdue?")
- Queries DB on-demand based on what it needs
- Never says "no access" (has 10 tools)

---

## ⚡ Example Conversation

**User**: `"ce piese sunt sub stoc minim?"`

**Backend Log**:
```
[INFO] AI chat request received
[INFO] Tool calling iteration 1/3
[INFO] Executing tool: getLowStockParts
[INFO] Tool getLowStockParts executed successfully
[INFO] AI chat completed successfully
```

**AI Response**:
```
Următoarele piese sunt sub stocul minim:

• Rulment 6204 - Stock: 5 buc, Min: 10 buc, Deficit: 5 buc
• Curea transmisie A-1200 - Stock: 2 buc, Min: 8 buc, Deficit: 6 buc
• Ulei hidraulic HLP 46 - Stock: 15 L, Min: 50 L, Deficit: 35 L

Recomand reaprovizionarea urgentă pentru aceste componente.
```

---

## 📖 Full Documentation

See `CMMS_COPILOT_COMPLETE.md` for:
- Detailed architecture
- Complete smoke tests
- Troubleshooting guide
- KPI calculation formulas
- Tool parameter schemas

---

**Status**: ✅ **READY TO USE**

The CMMS Copilot now has full READ-ONLY database access via 10 intelligent tools!
