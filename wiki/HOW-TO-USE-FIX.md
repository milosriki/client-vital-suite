# How to Use These Fix Resources

This guide explains how to use the documentation and resources provided to fix the MCP HubSpot tool validation error.

## If You're Seeing the Error Right Now

1. **Start Here**: Open [QUICK_FIX_MCP_HUBSPOT.md](./QUICK_FIX_MCP_HUBSPOT.md)
   - Follow the step-by-step instructions
   - It will take you through finding and fixing the configuration

2. **Need More Details?**: Check [MCP_HUBSPOT_FIX.md](./MCP_HUBSPOT_FIX.md)
   - Comprehensive guide with multiple fix options
   - Detailed explanations of the root cause
   - Examples of different array item types

3. **Want to See a Working Example?**: Look at [.vscode/mcp-config-example.json](./.vscode/mcp-config-example.json)
   - Shows correct JSON schema format
   - Examples of common HubSpot tool configurations
   - All array parameters have proper `items` definitions

## Understanding the Files

### Documentation Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `QUICK_FIX_MCP_HUBSPOT.md` | Quick reference guide | When you need immediate help |
| `MCP_HUBSPOT_FIX.md` | Comprehensive guide | When you want full details |
| `FIX_SUMMARY.md` | Executive summary | For overview and context |
| `.vscode/README.md` | VSCode config docs | Understanding workspace settings |

### Configuration Files

| File | Purpose | How to Use |
|------|---------|------------|
| `.vscode/settings.json` | Workspace settings | Auto-applied when you open the project |
| `.vscode/extensions.json` | Extension recommendations | VSCode will prompt to install |
| `.vscode/mcp-config-example.json` | Example MCP config | Use as reference for your own config |

## Step-by-Step Fix Process

### Phase 1: Locate the Problem (5 minutes)

1. Open VSCode Developer Tools:
   - **Windows/Linux**: `Ctrl + Shift + I`
   - **macOS**: `Cmd + Option + I`

2. Look for error details in the Console

3. Note the file path mentioned in the error

### Phase 2: Fix the Configuration (10 minutes)

1. Open the MCP configuration file (from Phase 1)

2. Search for `hubspot_create_engagement`

3. Find array parameters without `items`:
   ```json
   {
     "type": "array"
     // ❌ Missing items!
   }
   ```

4. Add `items` property:
   ```json
   {
     "type": "array",
     "items": {
       "type": "string"  // or whatever type is appropriate
     }
   }
   ```

5. Use `.vscode/mcp-config-example.json` as reference

### Phase 3: Verify the Fix (2 minutes)

1. Save the configuration file

2. Reload VSCode:
   - Press `Ctrl/Cmd + Shift + P`
   - Type "Reload Window"
   - Press Enter

3. Check if the error is gone

4. Verify MCP tools are working

## Common Scenarios

### Scenario 1: Can't Find the Configuration File

**Solution**: Follow the paths in [QUICK_FIX_MCP_HUBSPOT.md](./QUICK_FIX_MCP_HUBSPOT.md)

Common locations:
- Windows: `%APPDATA%\Code\User\settings.json`
- macOS: `~/Library/Application Support/Code/User/settings.json`
- Linux: `~/.config/Code/User/settings.json`

### Scenario 2: Don't Know What Type to Use for `items`

**Solution**: Look at the examples in `.vscode/mcp-config-example.json`

Common patterns:
- String array: `"items": { "type": "string" }`
- Number array: `"items": { "type": "number" }`
- Object array: `"items": { "type": "object", "properties": {...} }`

### Scenario 3: Error Persists After Fix

**Solutions** (try in order):

1. **Check JSON syntax**: Use a JSON validator
2. **Clear cache**: Restart VSCode completely
3. **Reinstall extension**: Uninstall and reinstall the MCP extension
4. **Report issue**: Contact the MCP HubSpot extension developer

## Preventing Future Issues

### For This Project

The VSCode workspace configuration (`.vscode/`) is now set up to:
- ✅ Enable JSON validation
- ✅ Download JSON schemas automatically
- ✅ Recommend helpful extensions
- ✅ Format code on save

These settings will help catch similar issues early.

### For Your MCP Configuration

**Best Practices**:

1. Always add `items` to array parameters
2. Validate JSON before saving
3. Use schema validation tools
4. Keep MCP extensions updated
5. Reference the example configuration

## Getting Help

### If You're Stuck

1. Read through all three main documents:
   - `QUICK_FIX_MCP_HUBSPOT.md`
   - `MCP_HUBSPOT_FIX.md`
   - `FIX_SUMMARY.md`

2. Check the VSCode Output panel:
   - View → Output
   - Select "MCP" from dropdown

3. Look for similar issues:
   - MCP extension GitHub repository
   - VSCode extension marketplace reviews

### If You Need to Report the Issue

Include:
- The exact error message
- Your operating system
- VSCode version
- MCP extension version
- Whether you can find the configuration file
- What you've tried so far

## Quick Reference

**Error**: `tool parameters array type must have items`

**Fix**: Add `items` property to array parameters in MCP configuration

**Example**:
```json
"items": { "type": "string" }
```

**Files to Check**:
1. `.vscode/mcp-config-example.json` - Examples
2. `QUICK_FIX_MCP_HUBSPOT.md` - Quick steps
3. `MCP_HUBSPOT_FIX.md` - Full guide

**Reload Command**: `Ctrl/Cmd + Shift + P` → "Reload Window"

---

## Summary

✅ **Documentation**: Complete guides available
✅ **Examples**: Working configurations provided
✅ **VSCode Config**: Workspace settings in place
✅ **Prevention**: Best practices documented

**Next Step**: Follow the guide in [QUICK_FIX_MCP_HUBSPOT.md](./QUICK_FIX_MCP_HUBSPOT.md) to fix the error.
