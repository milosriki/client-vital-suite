# Fix for MCP HubSpot Tool Validation Error

## Problem
Error message in VSCode:
```
Failed to validate tool mcp_hubspot-advan_hubspot_create_engagement: Error: tool parameters array type must have items.
```

## Root Cause
The MCP (Model Context Protocol) server for HubSpot has a tool definition with an invalid JSON schema. Specifically, there's a parameter with `type: "array"` that's missing the required `items` property.

According to JSON Schema specification, any property with `type: "array"` must include an `items` property that defines the type of elements in the array.

## Solution

### Option 1: Fix the MCP Server Configuration (Recommended)

If you have access to the HubSpot MCP server configuration file, locate it and fix the schema. The MCP server configuration is typically found in:

**Windows:**
```
%APPDATA%\Code\User\globalStorage\<extension-id>\mcp-config.json
```

**macOS:**
```
~/Library/Application Support/Code/User/globalStorage/<extension-id>/mcp-config.json
```

**Linux:**
```
~/.config/Code/User/globalStorage/<extension-id>/mcp-config.json
```

Or in VSCode settings:
```
~/.vscode/settings.json
```

Look for a tool definition similar to this (BROKEN):
```json
{
  "mcp_hubspot-advan_hubspot_create_engagement": {
    "input_schema": {
      "type": "object",
      "properties": {
        "some_array_param": {
          "type": "array",
          "description": "Some array parameter"
          // MISSING: items property!
        }
      }
    }
  }
}
```

Fix it by adding the `items` property (FIXED):
```json
{
  "mcp_hubspot-advan_hubspot_create_engagement": {
    "input_schema": {
      "type": "object",
      "properties": {
        "some_array_param": {
          "type": "array",
          "description": "Some array parameter",
          "items": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

### Option 2: Disable the HubSpot MCP Server Temporarily

If you don't need the HubSpot MCP server immediately, you can disable it in VSCode:

1. Open VSCode Settings (Ctrl/Cmd + ,)
2. Search for "MCP"
3. Find the HubSpot MCP server configuration
4. Disable or remove it temporarily

### Option 3: Update the MCP Extension

The issue might be in the MCP extension itself. Try updating:

1. Go to Extensions in VSCode (Ctrl/Cmd + Shift + X)
2. Search for MCP or HubSpot-related extensions
3. Update to the latest version
4. Reload VSCode

### Option 4: Report to MCP Server Maintainer

If the error persists, report this issue to the MCP server maintainer:

1. The error indicates a schema validation problem in the HubSpot MCP server
2. Include this error message in your report
3. The maintainer needs to fix the tool schema by adding `items` to all array-type parameters

## Common Array Items Types

When fixing the schema, use one of these patterns for the `items` property:

### String Array
```json
{
  "type": "array",
  "items": {
    "type": "string"
  }
}
```

### Number Array
```json
{
  "type": "array",
  "items": {
    "type": "number"
  }
}
```

### Object Array
```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" }
    },
    "required": ["id"]
  }
}
```

### Mixed Type Array (using anyOf)
```json
{
  "type": "array",
  "items": {
    "anyOf": [
      { "type": "string" },
      { "type": "number" }
    ]
  }
}
```

## VSCode Workspace Settings

To prevent similar issues in the future, you can add validation settings to your VSCode workspace. Create or update `.vscode/settings.json`:

```json
{
  "json.validate.enable": true,
  "json.schemas": []
}
```

## Verification

After applying the fix:

1. Reload VSCode window (Ctrl/Cmd + Shift + P → "Reload Window")
2. The error should no longer appear
3. MCP tools should work correctly

## Additional Resources

- [JSON Schema Documentation](https://json-schema.org/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- VSCode MCP Extension documentation

## Need Help?

If you continue to experience this issue:

1. Check the VSCode Developer Console (Help → Toggle Developer Tools) for detailed error logs
2. Look for the exact location of the problematic MCP server configuration
3. Share the relevant configuration snippet (with sensitive data removed) when seeking help

---

**Note:** This repository does not contain the MCP server configuration causing the error. The fix needs to be applied to your local VSCode MCP server configuration or the HubSpot MCP extension itself.
