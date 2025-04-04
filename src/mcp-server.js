/**
 * @fileoverview MCP Server for Crosspost
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Client } from "./client.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @import { Strategy } from "./types.js";
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const version = "0.10.0"; // x-release-please-version

const postSchema = {
	message: z.string(),
};

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * The CrossPostMcpServer class extends the McpServer to handle cross-posting
 * to multiple platforms using different strategies. It allows for flexible
 * configuration of strategies and provides prompts and tools for posting
 * messages to all or specific platforms.
 */
export class CrosspostMcpServer extends McpServer {
	/**
	 * The strategies used by this MCP server to handle requests.
	 * @type {Array<Strategy>}
	 */
	#strategies;

	/**
	 * The client instance used to interact with the MCP server.
	 * @type {Client}
	 */
	#client;

	/**
	 * Creates a enw instance.
	 * @param {Object} options The options for creating the MCP server instance.
	 * @param {Array<Strategy>} options.strategies The strategies to use for this instance.
	 */
	constructor({ strategies }) {
		super({
			name: "Crosspost",
			version,
		});

		if (!Array.isArray(strategies) || strategies.length === 0) {
			throw new TypeError("At least one strategy must be provided.");
		}

		this.#strategies = strategies;
		this.#client = new Client({
			strategies: this.#strategies,
		});

		// prompt to post to everything
		this.prompt("crosspost", postSchema, ({ message }) => ({
			messages: [
				{
					role: "user",
					content: {
						type: "text",
						text: `Post this message to all available services: ${message}`,
					},
				},
			],
		}));

		// prompt to post to a specific strategy
		for (const strategy of this.#strategies) {
			this.prompt(
				`post-to-${strategy.id}`,
				postSchema,
				({ message }) => ({
					messages: [
						{
							role: "user",
							content: {
								type: "text",
								text: `Post this message to ${strategy.name}: ${message}`,
							},
						},
					],
				}),
			);
		}

		// tool to post to all strategies
		this.tool(
			"crosspost",
			"Post to all available services.",
			postSchema,
			async ({ message }) => {
				const result = await this.#client.post(message);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result),
						},
					],
				};
			},
		);

		// tools to post to specific strategies
		for (const strategy of this.#strategies) {
			this.tool(
				`post-to-${strategy.id}`,
				`Post to ${strategy.name}`,
				postSchema,
				async ({ message }) => {
					const results = await strategy.post(message);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(results),
							},
						],
					};
				},
			);
		}
	}
}
