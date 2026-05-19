import { TOOL_DEFINITIONS, WEB_TOOL_DEFINITIONS, toAnthropicTools, toOpenAITools } from "./tool-definitions.js";

/** Home Assistant tools — always available */
export const HA_TOOLS = toAnthropicTools(TOOL_DEFINITIONS);

/** All tools for Anthropic (HA + web search when configured) */
export function getAnthropicTools(webSearchEnabled: boolean) {
  const defs = webSearchEnabled
    ? [...TOOL_DEFINITIONS, ...WEB_TOOL_DEFINITIONS]
    : TOOL_DEFINITIONS;
  return toAnthropicTools(defs);
}

/** All tools for OpenAI (HA + web search when configured) */
export function getOpenAITools(webSearchEnabled: boolean) {
  const defs = webSearchEnabled
    ? [...TOOL_DEFINITIONS, ...WEB_TOOL_DEFINITIONS]
    : TOOL_DEFINITIONS;
  return toOpenAITools(defs);
}
