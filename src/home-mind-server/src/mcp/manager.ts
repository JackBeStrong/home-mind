/**
 * McpManager — thin wrapper around @modelcontextprotocol/client SDK.
 *
 * Reads the standard mcpServers config format (same as Claude Desktop / Roo Code),
 * spawns each configured MCP server via StdioClientTransport, discovers tools,
 * and routes callTool requests to the correct server.
 *
 * Config format (JSON string from MCP_SERVERS env var):
 * {
 *   "mcpServers": {
 *     "yahoo-finance": {
 *       "command": "python3",
 *       "args": ["/app/mcp-servers/yahoo-finance-mcp/server.py"],
 *       "env": { "OPTIONAL_KEY": "value" }
 *     }
 *   }
 * }
 */

import { Client, StdioClientTransport } from "@modelcontextprotocol/client";
import type { ToolDefinition } from "../llm/tool-definitions.js";

/** Per-server config matching the standard mcpServers format */
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** Top-level config shape */
export interface McpServersConfig {
  mcpServers: Record<string, McpServerConfig>;
}

/** A connected MCP server with its client and discovered tools */
interface ConnectedServer {
  name: string;
  client: Client;
  transport: StdioClientTransport;
  toolNames: Set<string>;
}

export class McpManager {
  private servers: ConnectedServer[] = [];
  private toolToServer = new Map<string, ConnectedServer>();
  private allToolDefs: ToolDefinition[] = [];

  /**
   * Parse config and connect to all configured MCP servers.
   * Discovers tools from each server and builds a unified tool list.
   */
  async connect(configJson: string): Promise<void> {
    let parsed: McpServersConfig;
    try {
      parsed = JSON.parse(configJson);
    } catch (err) {
      console.error("[mcp] Failed to parse MCP_SERVERS config:", err);
      return;
    }

    if (!parsed.mcpServers || typeof parsed.mcpServers !== "object") {
      console.error("[mcp] MCP_SERVERS config missing 'mcpServers' key");
      return;
    }

    for (const [serverName, serverConfig] of Object.entries(parsed.mcpServers)) {
      try {
        await this.connectServer(serverName, serverConfig);
      } catch (err) {
        console.error(`[mcp] Failed to connect to MCP server '${serverName}':`, err);
      }
    }

    console.log(
      `[mcp] Connected to ${this.servers.length} MCP server(s), ` +
        `${this.allToolDefs.length} tool(s) available`
    );
  }

  private async connectServer(name: string, config: McpServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env
        ? { ...process.env as Record<string, string>, ...config.env }
        : (process.env as Record<string, string>),
    });

    const client = new Client({
      name: `home-mind-${name}`,
      version: "1.0.0",
    });

    await client.connect(transport);

    // Discover tools
    const { tools } = await client.listTools();
    const toolNames = new Set<string>();

    for (const tool of tools) {
      toolNames.add(tool.name);
      const def: ToolDefinition = {
        name: tool.name,
        description: tool.description ?? "",
        parameters: {
          type: "object",
          properties: (tool.inputSchema as Record<string, unknown>)?.properties as Record<string, unknown> ?? {},
          required: ((tool.inputSchema as Record<string, unknown>)?.required as string[]) ?? [],
        },
      };
      this.allToolDefs.push(def);
    }

    const server: ConnectedServer = { name, client, transport, toolNames };
    this.servers.push(server);

    // Map each tool name to its server for routing
    for (const toolName of toolNames) {
      this.toolToServer.set(toolName, server);
    }

    console.log(
      `[mcp] Server '${name}' connected: ${tools.length} tool(s) — ` +
        `[${tools.map((t) => t.name).join(", ")}]`
    );
  }

  /** Get all discovered MCP tool definitions (for LLM tool registration) */
  getToolDefinitions(): ToolDefinition[] {
    return this.allToolDefs;
  }

  /** Check if a tool name belongs to an MCP server */
  hasTool(toolName: string): boolean {
    return this.toolToServer.has(toolName);
  }

  /** Call a tool on the appropriate MCP server */
  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const server = this.toolToServer.get(toolName);
    if (!server) {
      return { error: `MCP tool not found: ${toolName}` };
    }

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: args,
      });

      // MCP callTool returns { content: Array<{ type, text }>, isError? }
      // Extract text content for the LLM
      if (result.isError) {
        const errorText = result.content
          ?.filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("\n");
        return { error: errorText || "MCP tool returned an error" };
      }

      const textParts = result.content
        ?.filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text);

      if (textParts && textParts.length === 1) {
        // Try to parse as JSON for structured data
        try {
          return JSON.parse(textParts[0]);
        } catch {
          return textParts[0];
        }
      }

      return textParts?.join("\n") ?? result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[mcp] callTool '${toolName}' on '${server.name}' failed:`, message);
      return { error: message };
    }
  }

  /** Gracefully disconnect all MCP servers */
  async disconnect(): Promise<void> {
    for (const server of this.servers) {
      try {
        await server.client.close();
        console.log(`[mcp] Disconnected from '${server.name}'`);
      } catch (err) {
        console.error(`[mcp] Error disconnecting '${server.name}':`, err);
      }
    }
    this.servers = [];
    this.toolToServer.clear();
    this.allToolDefs = [];
  }

  /** Whether any MCP servers are configured and connected */
  get isActive(): boolean {
    return this.servers.length > 0;
  }
}
