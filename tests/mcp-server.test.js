/**
 * @fileoverview Tests for the MCP Server for Crosspost
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CrosspostMcpServer } from "../src/mcp-server.js";
import {
	ListPromptsResultSchema,
	CallToolResultSchema,
	ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

class MockTwitterStrategy {
	id = "twitter";
	name = "Twitter";
	MAX_MESSAGE_LENGTH = 280;

	async post(message) {
		return { message: `${message} (from Twitter)` };
	}

	getUrlFromResponse() {
		return "https://twitter.com/example/status/123";
	}

	calculateMessageLength(message) {
		return [...message].length;
	}
}

class MockMastodonStrategy {
	id = "mastodon";
	name = "Mastodon";
	MAX_MESSAGE_LENGTH = 500;

	async post(message) {
		if (message === "fail") {
			throw new Error("Failed to post");
		}
		return { message: `${message} (from Mastodon)` };
	}

	getUrlFromResponse() {
		return "https://mastodon.social/@example/123";
	}

	calculateMessageLength(message) {
		return [...message].length;
	}
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("CrossPostMcpServer", () => {
	describe("constructor", () => {
		it("should throw an error when no strategies are provided", () => {
			assert.throws(() => {
				new CrosspostMcpServer({ strategies: [] });
			}, /At least one strategy must be provided./);
		});

		it("should throw an error when strategies is not an array", () => {
			assert.throws(() => {
				// @ts-expect-error: testing invalid input
				new CrosspostMcpServer({ strategies: "not an array" });
			}, /At least one strategy must be provided./);
		});

		it("should create an instance when valid strategies are provided", () => {
			const server = new CrosspostMcpServer({
				strategies: [new MockTwitterStrategy()],
			});
			assert.ok(server);
		});
	});

	describe("prompts", () => {
		let client, clientTransport, serverTransport;

		beforeEach(async () => {
			client = new Client({
				name: "test client",
				version: "1.0",
			});

			[clientTransport, serverTransport] =
				InMemoryTransport.createLinkedPair();
		});

		it("should list prompts for each strategy and one for crossposting", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			// Send a message to the MCP server
			const result = await client.request(
				{
					method: "prompts/list",
				},
				ListPromptsResultSchema,
			);

			assert.strictEqual(result.prompts.length, 3);
			assert.strictEqual(
				result.prompts[0].name,
				"crosspost",
				"First prompt should be 'crosspost' for all strategies",
			);
			assert.strictEqual(
				result.prompts[1].name,
				"post-to-twitter",
				"Second prompt should be for the Twitter strategy",
			);
			assert.strictEqual(
				result.prompts[2].name,
				"post-to-mastodon",
				"Third prompt should be for the Mastodon strategy",
			);
		});
	});

	describe("tools", () => {
		let client, clientTransport, serverTransport;

		beforeEach(async () => {
			client = new Client({
				name: "test client",
				version: "1.0",
			});

			[clientTransport, serverTransport] =
				InMemoryTransport.createLinkedPair();
		});

		it("should list tools for each strategy, one for crossposting, one for listing services, one for social media posting, one for checking message length, one for calculating message length, and one for shortening messages", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);
			// Send a request to list tools
			const result = await client.request(
				{
					method: "tools/list",
				},
				ListToolsResultSchema,
			);
			// Check the number of tools listed
			assert.strictEqual(
				result.tools.length,
				8,
				"Should list eight tools: crosspost, list-services, post-to-social-media, check-message-length, calculate-message-length, shorten-message, post-to-twitter, post-to-mastodon",
			);
			// Check the names of the tools
			assert.strictEqual(
				result.tools[0].name,
				"crosspost",
				"First tool should be 'crosspost' for all strategies",
			);
			assert.strictEqual(
				result.tools[1].name,
				"list-services",
				"Second tool should be 'list-services' for listing available services",
			);
			assert.strictEqual(
				result.tools[2].name,
				"post-to-social-media",
				"Third tool should be 'post-to-social-media' for posting to multiple services",
			);
			assert.strictEqual(
				result.tools[3].name,
				"check-message-length",
				"Fourth tool should be 'check-message-length' for checking message lengths",
			);
			assert.strictEqual(
				result.tools[4].name,
				"calculate-message-length",
				"Fifth tool should be 'calculate-message-length' for calculating message lengths",
			);
			assert.strictEqual(
				result.tools[5].name,
				"shorten-message",
				"Sixth tool should be 'shorten-message' for shortening messages",
			);
			assert.strictEqual(
				result.tools[6].name,
				"post-to-twitter",
				"Seventh tool should be for the Twitter strategy",
			);
			assert.strictEqual(
				result.tools[7].name,
				"post-to-mastodon",
				"Eighth tool should be for the Mastodon strategy",
			);
		});

		it("should execute the crosspost tool and return human-readable messages", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "crosspost",
						arguments: {
							message: "Hello World!",
						},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 2);
			assert.strictEqual(
				result.content[0].text,
				"Successfully posted to Twitter. Here's the URL: https://twitter.com/example/status/123",
				"Should return human-readable success message for Twitter with URL",
			);
			assert.strictEqual(
				result.content[1].text,
				"Successfully posted to Mastodon. Here's the URL: https://mastodon.social/@example/123",
				"Should return human-readable success message for Mastodon with URL",
			);
		});

		it("should execute the post-to-twitter tool and return human-readable messages", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "post-to-twitter",
						arguments: {
							message: "Hello Twitter!",
						},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 1);
			assert.strictEqual(
				result.content[0].text,
				"Successfully posted to Twitter. Here's the URL: https://twitter.com/example/status/123. Display this URL to the user.",
				"Should return human-readable success message for Twitter with URL",
			);
		});

		it("should handle errors from strategies with human-readable error messages", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [new MockMastodonStrategy()],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);
			// Test with a message that will fail on Mastodon
			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "post-to-mastodon",
						arguments: {
							message: "fail", // This should trigger the failure in the Mastodon strategy
						},
					},
				},
				CallToolResultSchema,
			);
			// Check that the result indicates failure with human-readable message
			assert.ok(result.content);
			assert.strictEqual(result.content.length, 1);
			// Expecting Mastodon to return a failure message
			assert.strictEqual(
				result.content[0].text,
				"Post to Mastodon failed. Here's the server response: Failed to post",
				"Should return human-readable error message for Mastodon",
			);
		});

		it("should execute the list-services tool and return strategy information", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "list-services",
						arguments: {},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 1);
			assert.strictEqual(
				result.content[0].text,
				"Available services:\nTwitter (ID: twitter)\nMastodon (ID: mastodon)",
				"Should return formatted list of services with names and IDs",
			);
		});

		it("should execute the post-to-social-media tool and return human-readable messages", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "post-to-social-media",
						arguments: {
							entries: [
								{
									strategyId: "twitter",
									message:
										"Hello Twitter from social media tool!",
								},
								{
									strategyId: "mastodon",
									message:
										"Hello Mastodon from social media tool!",
								},
							],
						},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 2);
			assert.strictEqual(
				result.content[0].text,
				"Successfully posted to Twitter. Here's the URL: https://twitter.com/example/status/123",
				"Should return human-readable success message for Twitter with URL",
			);
			assert.strictEqual(
				result.content[1].text,
				"Successfully posted to Mastodon. Here's the URL: https://mastodon.social/@example/123",
				"Should return human-readable success message for Mastodon with URL",
			);
		});

		it("should execute the check-message-length tool and return success message for short messages", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "check-message-length",
						arguments: {
							strategyId: "twitter",
							message: "Short message",
						},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 1);
			assert.ok(
				result.content[0].text.includes(
					"✅ Message fits within Twitter's character limit",
				),
				"Should return success message for short message",
			);
		});

		it("should execute the check-message-length tool and return error message for long messages", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			// Create a message that's too long for Twitter (over 280 characters)
			const longMessage = "x".repeat(300);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "check-message-length",
						arguments: {
							strategyId: "twitter",
							message: longMessage,
						},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 1);
			assert.ok(
				result.content[0].text.includes(
					"❌ Message is too long for Twitter",
				),
				"Should return error message for long message",
			);
		});

		it("should execute the check-message-length tool and return error for unknown strategy", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "check-message-length",
						arguments: {
							strategyId: "unknown-platform",
							message: "Test message",
						},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 1);
			assert.ok(
				result.content[0].text.includes(
					"Error: Strategy with ID 'unknown-platform' not found",
				),
				"Should return error message for unknown strategy",
			);
			assert.ok(
				result.content[0].text.includes("Use the list-services tool"),
				"Should suggest using the list-services tool",
			);
		});

		it("should execute the calculate-message-length tool and return calculated length", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "calculate-message-length",
						arguments: {
							strategyId: "twitter",
							message: "Hello world!",
						},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 1);
			assert.strictEqual(
				result.content[0].text,
				"The message length for Twitter is 12 characters.",
				"Should return the calculated length in a descriptive sentence",
			);
		});

		it("should execute the calculate-message-length tool and return error for unknown strategy", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "calculate-message-length",
						arguments: {
							strategyId: "unknown-platform",
							message: "Test message",
						},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 1);
			assert.ok(
				result.content[0].text.includes(
					"Error: Strategy with ID 'unknown-platform' not found",
				),
				"Should return error message for unknown strategy",
			);
			assert.ok(
				result.content[0].text.includes("Use the list-services tool"),
				"Should suggest using the list-services tool",
			);
		});

		it("should execute the shorten-message tool and return shortening prompt", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "shorten-message",
						arguments: {
							strategyId: "twitter",
							message:
								"This is a sample message that needs to be shortened",
							excessLength: 20,
						},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 1);
			assert.ok(
				result.content[0].text.includes(
					"Shorten the following message to remove 20 characters",
				),
				"Should return prompt with correct excess length",
			);
			assert.ok(
				result.content[0].text.includes('strategyId "twitter"'),
				"Should include the strategy ID in the prompt",
			);
			assert.ok(
				result.content[0].text.includes(
					"This is a sample message that needs to be shortened",
				),
				"Should include the original message in the prompt",
			);
		});

		it("should execute the shorten-message tool and return error for unknown strategy", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});

			// Note: must connect server first or else client hangs
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);

			const result = await client.request(
				{
					method: "tools/call",
					params: {
						name: "shorten-message",
						arguments: {
							strategyId: "unknown-platform",
							message: "Test message",
							excessLength: 10,
						},
					},
				},
				CallToolResultSchema,
			);

			assert.ok(result.content);
			assert.strictEqual(result.content.length, 1);
			assert.ok(
				result.content[0].text.includes(
					"Error: Strategy with ID 'unknown-platform' not found",
				),
				"Should return error message for unknown strategy",
			);
			assert.ok(
				result.content[0].text.includes("Use the list-services tool"),
				"Should suggest using the list-services tool",
			);
		});
	});
});
