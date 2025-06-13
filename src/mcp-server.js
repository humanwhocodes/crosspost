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
// Prompts
//-----------------------------------------------------------------------------

/**
 * Generates a prompt for shortening a message to fit within a strategy's character limit.
 * @param {string} strategyId The ID of the strategy.
 * @param {string} message The message to shorten.
 * @param {number} excessLength The number of characters to remove.
 * @returns {string} A formatted prompt for shortening the message.
 */
function shortenMessagePrompt(strategyId, message, excessLength) {
	return `
You are given a social media message and the number of characters that need to be removed to make it fit within a predefined limit. Your task is to shorten the message so that it fits within the specified limit, while preserving the original meaning and tone. If the message contains any URLs, they must be kept intact and unmodified.

Tips for shortening the message:

	- Remove unnecessary words, filler phrases, or repetition.
	- Use abbreviations or contractions where appropriate.
	- Replace longer phrases with shorter synonyms.
	- Omit non-essential details or qualifiers.
	- Reorder sentences or clauses to be more concise.
	- If the message contains multiple sentences, consider combining or restructuring them.
	- Do not remove any URLs or modify them in any way.

Instructions:

	- Shorten the following message to remove ${excessLength} characters as calculated by the check-message-length tool with strategyId "${strategyId}", following the tips above.
	- Make sure all URLs in the original message are kept as-is in your final output.
	- Ensure the core message and intent remain unchanged.
	- Remove as few characters as possible while still achieving the required length. Example: if the message is 300 characters long and needs to be shortened by 20 characters, your final output should be between 270 and 280 characters long.
	- Never shorten a message so that it's more than 20 characters shorter than the strategy limit.
	- Retain any newlines that appear after URLs in the original message.

Original Message:
${message}
	`;
}

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const version = "0.12.0"; // x-release-please-version

const postSchema = {
	message: z.string(),
};

const postToSocialMediaSchema = {
	entries: z.array(
		z.object({
			strategyId: z.string(),
			message: z.string(),
		}),
	),
};

const strategyMessageSchema = {
	strategyId: z.string(),
	message: z.string(),
};

const shortenMessageSchema = {
	strategyId: z.string(),
	message: z.string(),
	excessLength: z.number(),
};

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

		// tool to list all available services
		this.tool(
			"list-services",
			"List all available social media services with their names and IDs.",
			{},
			async () => {
				const strategies = this.#strategies.map(strategy => ({
					id: strategy.id,
					name: strategy.name,
				}));

				const content = strategies
					.map(strategy => `${strategy.name} (ID: ${strategy.id})`)
					.join("\n");

				return {
					content: [
						{
							type: "text",
							text: `Available services:\n${content}`,
						},
					],
				};
			},
		);

		// tool to post to multiple social media services
		this.tool(
			"post-to-social-media",
			"Post the same message to one or more social media services (if possible). When using this tool, you must provide an array of entries with strategyId and message. Check the message length using the check-message-length tool and the corresponding strategy before posting. If the message doesn't fit within the strategy's limits, use the shorten-message tool to generate a shortened version of the message for just that strategy. You must not post a message that exceeds the character limit of any strategy.",
			postToSocialMediaSchema,
			async ({ entries }) => {
				// const results = await this.#client.postTo(entries);

				// const content = results.map(result => {
				// 	if (result.ok) {
				// 		const okResponse = /** @type {SuccessResponse} */ (
				// 			result
				// 		);
				// 		return {
				// 			type: /** @type {const} */ ("text"),
				// 			text: getSuccessMessage(okResponse),
				// 		};
				// 	} else {
				// 		const failureResponse = /** @type {FailureResponse} */ (
				// 			result
				// 		);
				// 		return {
				// 			type: /** @type {const} */ ("text"),
				// 			text: getFailureMessage(failureResponse),
				// 		};
				// 	}
				// });
				console.log(JSON.stringify(entries));

				// return {
				// 	content: content,
				// };
				return {
					content: [
						{
							type: "text",
							text: "It worked!",
						},
					],
				};
			},
		);

		// tool to check message length against a strategy's limits
		this.tool(
			"check-message-length",
			"Check if a message fits within a specific social media service's character limit.",
			strategyMessageSchema,
			async ({ strategyId, message }) => {
				// Find the strategy by ID
				const strategy = this.#strategies.find(
					s => s.id === strategyId,
				);

				if (!strategy) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Strategy with ID '${strategyId}' not found. Use the list-services tool to see available services.`,
							},
						],
					};
				}

				// Calculate the message length using the strategy's algorithm
				const calculatedLength =
					strategy.calculateMessageLength(message);
				const maxLength = strategy.MAX_MESSAGE_LENGTH;

				let responseText;
				if (calculatedLength <= maxLength) {
					responseText = `✅ Message fits within ${strategy.name}'s character limit. Length: ${calculatedLength}/${maxLength} characters.`;
				} else {
					const excess = calculatedLength - maxLength;
					responseText = `❌ Message is too long for ${strategy.name}. Length: ${calculatedLength}/${maxLength} characters (${excess} characters over limit).`;
				}

				return {
					content: [
						{
							type: "text",
							text: responseText,
						},
					],
				};
			},
		);

		// tool to calculate message length using a strategy's algorithm
		this.tool(
			"calculate-message-length",
			"Calculate the length of a message using a specific social media service's character counting algorithm.",
			strategyMessageSchema,
			async ({ strategyId, message }) => {
				// Find the strategy by ID
				const strategy = this.#strategies.find(
					s => s.id === strategyId,
				);

				if (!strategy) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Strategy with ID '${strategyId}' not found. Use the list-services tool to see available services.`,
							},
						],
					};
				}

				// Calculate the message length using the strategy's algorithm
				const calculatedLength =
					strategy.calculateMessageLength(message);

				return {
					content: [
						{
							type: "text",
							text: `The message length for ${strategy.name} is ${calculatedLength} characters.`,
						},
					],
				};
			},
		);

		// tool to shorten a message to fit within a strategy's limits
		this.tool(
			"shorten-message",
			"Creates a prompt to shorten a message to fit within a specific social media service's character limit. If provided with a strategy name, call list-services to find the strategyId.",
			shortenMessageSchema,
			async ({ strategyId, message, excessLength }) => {
				// Find the strategy by ID
				const strategy = this.#strategies.find(
					s => s.id === strategyId,
				);

				if (!strategy) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Strategy with ID '${strategyId}' not found. Use the list-services tool to see available services.`,
							},
						],
					};
				}

				// Generate the shortening prompt
				const prompt = shortenMessagePrompt(
					strategyId,
					message,
					excessLength,
				);

				return {
					content: [
						{
							type: "text",
							text: prompt,
						},
					],
				};
			},
		);

		// tools to post to specific strategies
		// for (const strategy of this.#strategies) {
		// 	this.tool(
		// 		`post-to-${strategy.id}`,
		// 		`Post to ${strategy.name}`,
		// 		postSchema,
		// 		async ({ message }) => {
		// 			try {
		// 				const result = await strategy.post(message);
		// 				const url = strategy.getUrlFromResponse?.(result);
		// 				let text = `Successfully posted to ${strategy.name}.`;
		// 				if (url) {
		// 					text += ` Here's the URL: ${url}. Display this URL to the user.`;
		// 				}

		// 				return {
		// 					content: [{ type: "text", text }],
		// 				};
		// 			} catch (ex) {
		// 				const error = /** @type {Error} */ (ex);
		// 				return {
		// 					content: [
		// 						{
		// 							type: "text",
		// 							text: `Post to ${strategy.name} failed. Here's the server response: ${error.message}`,
		// 						},
		// 					],
		// 				};
		// 			}
		// 		},
		// 	);
		// }
	}
}
