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
 * @import { SuccessResponse, FailureResponse } from "./client.js";
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const version = "0.11.1"; // x-release-please-version

const postSchema = {
	message: z.string(),
};

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Generates a success message based on the response.
 * @param {SuccessResponse} response The successful response from a strategy.
 * @returns {string} A formatted success message.
 */
function getSuccessMessage(response) {
	let message = `Successfully posted to ${response.name}.`;
	if (response.url) {
		message += ` Here's the URL: ${response.url}`;
	}
	return message;
}

/**
 * Generates a failure message based on the response.
 * @param {FailureResponse} response The failed response from a strategy.
 * @returns {string} A formatted failure message.
 */
function getFailureMessage(response) {
	let message = `Post to ${response.name} failed.`;
	if (response.reason) {
		message += ` Here's the server response: ${JSON.stringify(response.reason)}`;
	}
	return message;
}

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
				const results = await this.#client.post(message);

				const content = results.map(result => {
					if (result.ok) {
						const okResponse = /** @type {SuccessResponse} */ (
							result
						);
						return {
							type: /** @type {const} */ ("text"),
							text: getSuccessMessage(okResponse),
						};
					} else {
						const failureResponse = /** @type {FailureResponse} */ (
							result
						);
						return {
							type: /** @type {const} */ ("text"),
							text: getFailureMessage(failureResponse),
						};
					}
				});

				return {
					content: content,
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
					try {
						const result = await strategy.post(message);
						const url = strategy.getUrlFromResponse?.(result);
						let text = `Successfully posted to ${strategy.name}.`;
						if (url) {
							text += ` Here's the URL: ${url}. Display this URL to the user.`;
						}

						return {
							content: [{ type: "text", text }],
						};
					} catch (ex) {
						const error = /** @type {Error} */ (ex);
						return {
							content: [
								{
									type: "text",
									text: `Post to ${strategy.name} failed. Here's the server response: ${error.message}`,
								},
							],
						};
					}
				},
			);
		}
	}
}
