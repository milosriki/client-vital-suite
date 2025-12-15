# Quick Fix Guide: MCP HubSpot Tool Validation Error

## Problem
You're seeing this error in VSCode:
```
Failed to validate tool mcp_hubspot-advan_hubspot_create_engagement: Error: tool parameters array type must have items.
```

## Quick Solution Steps

### Step 1: Find Your MCP Configuration

Open VSCode Developer Tools:
- **Windows/Linux:** `Ctrl + Shift + I` or `Help > Toggle Developer Tools`
- **macOS:** `Cmd + Option + I` or `Help > Toggle Developer Tools`

In the Console tab, look for error details that show the exact file path.

### Step 2: Common MCP Configuration Locations

Check these locations for MCP server configurations:

**Windows:**
```
C:\Users\<YourUsername>\AppData\Roaming\Code\User\settings.json
C:\Users\<YourUsername>\.vscode\extensions\
```

**macOS:**
```
~/Library/Application Support/Code/User/settings.json
~/.vscode/extensions/
```

**Linux:**
```
~/.config/Code/User/settings.json
~/.vscode/extensions/
```

### Step 3: Fix the Schema

Open the MCP configuration file and search for `hubspot_create_engagement` or `hubspot-advan`.

Find the problematic array parameter (it will have `"type": "array"` but no `"items"` property).

**Before (Broken):**
```json
{
  "parameters": {
    "type": "array"
  }
}
```

**After (Fixed):**
```json
{
  "parameters": {
    "type": "array",
    "items": {
      "type": "string"
    }
  }
}
```

### Step 4: Reload VSCode

After saving your changes:
1. Press `Ctrl/Cmd + Shift + P`
2. Type "Reload Window"
3. Press Enter

## Alternative Solutions

### Option A: Disable the MCP Server Temporarily

If you can't find the configuration:

1. Open VSCode Settings (`Ctrl/Cmd + ,`)
2. Search for "MCP" or "Model Context Protocol"
3. Disable the HubSpot MCP server
4. Reload VSCode

### Option B: Reinstall the MCP Extension

1. Go to Extensions (`Ctrl/Cmd + Shift + X`)
2. Search for MCP or HubSpot extensions
3. Uninstall
4. Reinstall
5. Reload VSCode

### Option C: Contact Extension Developer

If the error persists:

1. Find the HubSpot MCP extension in VSCode Marketplace
2. Report the issue on their GitHub repository
3. Include the error message and mention that array parameters need `items` property

## What's the Technical Issue?

The MCP server's tool definition violates JSON Schema specification. According to the spec:

> Any property with `type: "array"` must include an `items` property that defines what type of elements the array can contain.

The HubSpot MCP server has a tool called `hubspot_create_engagement` with at least one parameter that:
- Has `type: "array"` ✓
- But is missing `items: {...}` ✗

This causes VSCode's JSON schema validator to reject the tool definition.

## Need More Help?

1. Check the full documentation: `MCP_HUBSPOT_FIX.md` in this repository
2. Look at VSCode's Output panel (View → Output) and select "MCP" from the dropdown
3. Check the VSCode Console for detailed stack traces
4. Search for similar issues in the MCP server's GitHub repository

## Verification

After applying the fix, you should:

1. See no error messages in VSCode
2. Be able to use MCP tools normally
3. See the HubSpot tools in your MCP tools list

---

✅ The `.vscode` directory in this repository now contains recommended settings to help prevent similar validation issues.
