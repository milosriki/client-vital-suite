# VSCode Configuration for Client Vital Suite

This directory contains VSCode workspace settings and MCP configuration examples to help prevent and fix common issues.

## Files

### `settings.json`
Workspace-specific VSCode settings that:
- Enable JSON validation
- Enable schema downloads
- Format code on save
- Configure TypeScript settings

### `extensions.json`
Recommended VSCode extensions for this project:
- ESLint for JavaScript/TypeScript linting
- Prettier for code formatting
- Tailwind CSS IntelliSense
- TypeScript language features

### `mcp-config-example.json`
Example MCP (Model Context Protocol) server configuration showing the **correct** format for HubSpot tools.

**Key Points:**
- All array parameters must have an `items` property
- Proper JSON Schema validation for tool definitions
- Examples of common HubSpot operations

## MCP Configuration

### Where to Place MCP Configuration

This example file shows the correct format, but MCP configurations are typically placed in:

**Global Settings:**
- Windows: `%APPDATA%\Code\User\settings.json`
- macOS: `~/Library/Application Support/Code/User/settings.json`
- Linux: `~/.config/Code/User/settings.json`

**Or in VSCode Settings UI:**
1. Open Settings (Ctrl/Cmd + ,)
2. Search for "MCP"
3. Edit in settings.json

### Common Array Parameter Patterns

When defining MCP tools, always include `items` for array types:

```json
{
  "parameterName": {
    "type": "array",
    "items": {
      "type": "string"  // or "number", "object", etc.
    }
  }
}
```

For arrays of objects:
```json
{
  "parameterName": {
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
}
```

## Troubleshooting

If you see "tool parameters array type must have items" error:

1. Check the main fix guide: `../MCP_HUBSPOT_FIX.md`
2. Review the quick fix guide: `../QUICK_FIX_MCP_HUBSPOT.md`
3. Compare your MCP config with `mcp-config-example.json`
4. Ensure all array parameters have the `items` property

## Related Documentation

- [MCP_HUBSPOT_FIX.md](../MCP_HUBSPOT_FIX.md) - Comprehensive fix guide
- [QUICK_FIX_MCP_HUBSPOT.md](../QUICK_FIX_MCP_HUBSPOT.md) - Quick reference guide

## Contributing

When adding new VSCode settings or MCP configurations:

1. Ensure they follow JSON Schema standards
2. Test configurations before committing
3. Document any new settings in this README
4. Use the example files as templates

---

**Note:** The `mcp-config-example.json` file is for reference only and is not automatically loaded by VSCode. You need to manually configure your MCP servers in your VSCode settings or global MCP configuration.
