import { TOOL_DEFINITIONS, WEB_TOOL_DEFINITIONS, toAnthropicTools, toOpenAITools, type ToolDefinition } from "./tool-definitions.js";

/** Home Assistant tools — always available */
export const HA_TOOLS = toAnthropicTools(TOOL_DEFINITIONS);

/** All tools for Anthropic (HA + web search when configured + MCP tools) */
export function getAnthropicTools(webSearchEnabled: boolean, mcpTools: ToolDefinition[] = []) {
  const defs = webSearchEnabled
    ? [...TOOL_DEFINITIONS, ...WEB_TOOL_DEFINITIONS, ...mcpTools]
    : [...TOOL_DEFINITIONS, ...mcpTools];
  return toAnthropicTools(defs);
}

/** All tools for OpenAI (HA + web search when configured + MCP tools) */
export function getOpenAITools(webSearchEnabled: boolean, mcpTools: ToolDefinition[] = []) {
  const defs = webSearchEnabled
    ? [...TOOL_DEFINITIONS, ...WEB_TOOL_DEFINITIONS, ...mcpTools]
    : [...TOOL_DEFINITIONS, ...mcpTools];
  return toOpenAITools(defs);
}
