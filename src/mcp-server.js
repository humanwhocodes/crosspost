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
 * IMPORTANT: Avoid using the term "shorten" in the prompt as this encourages the model
 * to remove content rather than rephrase it to fit within the limits.
 * @param {string} strategyId The ID of the strategy.
 * @param {string} message The message to shorten.
 * @param {number} excessLength The number of characters to remove.
 * @param {number} maxLength The maximum length of the message after shortening.
 * @returns {string} A formatted prompt for shortening the message.
 */
function shortenMessagePrompt(strategyId, message, excessLength, maxLength) {
	// Use tight ranges - only 10 characters of wiggle room
	const minLength = maxLength - 10;

	return `
You are a social media assistant tasked with creating messages that maximize the
use of available characters for a social media platform post. The character
limit for ${strategyId} is ${maxLength} characters. The message you create must
be at least ${minLength} characters long and no more than ${maxLength} characters long.
The original message exceeds the maximum length by ${excessLength} characters.

You must preserve as much of the original message as possible while keeping the
original meaning and tone. If the message contains any URLs, they must be kept intact and unmodified.

Tips for resizing the message:

	- Remove unnecessary words, filler phrases, or repetition.
	- Use abbreviations or contractions where appropriate.
	- Replace longer phrases with shorter synonyms.
	- Omit non-essential details or qualifiers.
	- Reorder sentences or clauses to be more concise.
	- If the message contains multiple sentences, consider combining or restructuring them.
	
	Instructions:
	
	- Maximize the use of available characters. Aim to get as close to the maximum ${maxLength} length as possible without exceeding it. A message length less than ${minLength} characters wastes valuable space.
	- Aim to get within 5 characters of the maximum length rather than leaving significant unused space.
	- Do not remove any URLs or modify them in any way.
	- You must retain any line breaks that appear after URLs in the original message.
	- Do not use emdashes unless they are already present in the original message.
	- IMPORTANT: Call the calculate-message-length tool to verify the message is at least ${minLength} characters long and not longer than ${maxLength} characters long.

Original Message:
${message}
	`;
}

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const version = "1.0.1"; // x-release-please-version

const postSchema = {
	message: z.string(),
};

const socialMediaPostSchema = {
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

		// #region Prompts

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

		// #endregion Prompts

		// #region Tools

		this.tool(
			"crosspost",
			"Returns a prompt to crosspost a message to all available services. Use the post-to-social-media tool to actually post the message.",
			postSchema,
			({ message }) => ({
				content: [
					{
						type: "text",
						text: `Post this message to all available services: ${message}`,
					},
				],
			}),
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
			"Post the same message to one or more social media services (if possible). When using this tool, you must provide an array of entries with strategyId and message. Check the message length using the check-message-length tool and the corresponding strategy before posting. If the message doesn't fit within the strategy's limits, ask the user if they'd like you to shorten it for any of the services. If no, post the original message; if yes, then use the resize-message tool to generate a more appropriate version of the message for just that strategy. Prepare appropriate message versions for all services first, then post them all together in a single batch.",
			socialMediaPostSchema,
			async ({ entries }) => {
				const results = await this.#client.postTo(entries);

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

		// tool to check message length against a strategy's limits
		this.tool(
			"check-message-length",
			"Check if messages fit within specific social media services' character limits. When using this tool, provide an array of entries with strategyId and message.",
			socialMediaPostSchema,
			async ({ entries }) => {
				/** @type {Array<string>} */
				const responses = [];

				for (const { strategyId, message } of entries) {
					// Find the strategy by ID
					const strategy = this.#strategies.find(
						s => s.id === strategyId,
					);

					if (!strategy) {
						responses.push(
							`Error: Strategy with ID '${strategyId}' not found. Use the list-services tool to see available services.`,
						);
						continue;
					}

					// Calculate the message length using the strategy's algorithm
					const calculatedLength =
						strategy.calculateMessageLength(message);
					const maxLength = strategy.MAX_MESSAGE_LENGTH;

					if (calculatedLength <= maxLength) {
						responses.push(
							`✅ Message fits within ${strategy.name}'s character limit. Length: ${calculatedLength}/${maxLength} characters.`,
						);
					} else {
						const excess = calculatedLength - maxLength;
						responses.push(
							`❌ Message is too long for ${strategy.name}. Length: ${calculatedLength}/${maxLength} characters (${excess} characters over limit).`,
						);
					}
				}

				return {
					content: [
						{
							type: "text",
							text: responses.join("\n"),
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
			"resize-message",
			"Creates a prompt to resize a message to fit within a specific social media service's character limit. If provided with a strategy name, call list-services to find the strategyId.",
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
					strategy.MAX_MESSAGE_LENGTH,
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
	}
}
