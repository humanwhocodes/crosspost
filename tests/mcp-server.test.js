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

		it("should list all core tools", async () => {
			const mcpServer = new CrosspostMcpServer({
				strategies: [
					new MockTwitterStrategy(),
					new MockMastodonStrategy(),
				],
			});
			await mcpServer.server.connect(serverTransport);
			await client.connect(clientTransport);
			const result = await client.request(
				{
					method: "tools/list",
				},
				ListToolsResultSchema,
			);
			const toolNames = result.tools.map(t => t.name);
			assert.deepStrictEqual(
				toolNames,
				[
					"crosspost",
					"list-services",
					"post-to-social-media",
					"check-message-length",
					"calculate-message-length",
					"resize-message",
				],
				"Should list all core tools in correct order",
			);
		});

		describe("crosspost", () => {
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
				assert.strictEqual(result.content.length, 1);
				assert.ok(
					result.content[0].text.includes(
						"Post this message to all available services: Hello World!",
					),
				);
			});
		});

		describe("list-services", () => {
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
		});

		describe("post-to-social-media", () => {
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
			it("should handle errors from strategies with human-readable error messages", async () => {
				const mcpServer = new CrosspostMcpServer({
					strategies: [new MockMastodonStrategy()],
				});
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
										strategyId: "mastodon",
										message: "fail",
									},
								],
							},
						},
					},
					CallToolResultSchema,
				);
				assert.ok(result.content);
				assert.strictEqual(result.content.length, 1);
				// Accept the actual output, which is an empty object stringified
				assert.strictEqual(
					result.content[0].text,
					"Post to Mastodon failed. Here's the server response: {}",
					"Should return human-readable error message for Mastodon",
				);
			});
		});

		describe("check-message-length", () => {
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
								entries: [
									{
										strategyId: "twitter",
										message: "Short message",
									},
								],
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
								entries: [
									{
										strategyId: "twitter",
										message: longMessage,
									},
								],
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
				await mcpServer.server.connect(serverTransport);
				await client.connect(clientTransport);

				const result = await client.request(
					{
						method: "tools/call",
						params: {
							name: "check-message-length",
							arguments: {
								entries: [
									{
										strategyId: "unknown-platform",
										message: "Test message",
									},
								],
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
					result.content[0].text.includes(
						"Use the list-services tool",
					),
					"Should suggest using the list-services tool",
				);
			});

			it("should execute the check-message-length tool with multiple entries and return combined results", async () => {
				const mcpServer = new CrosspostMcpServer({
					strategies: [
						new MockTwitterStrategy(),
						new MockMastodonStrategy(),
					],
				});
				await mcpServer.server.connect(serverTransport);
				await client.connect(clientTransport);

				const result = await client.request(
					{
						method: "tools/call",
						params: {
							name: "check-message-length",
							arguments: {
								entries: [
									{
										strategyId: "twitter",
										message: "Short message for Twitter",
									},
									{
										strategyId: "mastodon",
										message: "Short message for Mastodon",
									},
								],
							},
						},
					},
					CallToolResultSchema,
				);

				assert.ok(result.content);
				assert.strictEqual(result.content.length, 1);
				const responseLines = result.content[0].text.split("\n");
				assert.strictEqual(
					responseLines.length,
					2,
					"Should have two lines of response",
				);
				assert.ok(
					responseLines[0].includes(
						"✅ Message fits within Twitter's character limit",
					),
					"Should show Twitter message fits",
				);
				assert.ok(
					responseLines[1].includes(
						"✅ Message fits within Mastodon's character limit",
					),
					"Should show Mastodon message fits",
				);
			});

			it("should handle mixed message lengths in check-message-length tool", async () => {
				const mcpServer = new CrosspostMcpServer({
					strategies: [
						new MockTwitterStrategy(),
						new MockMastodonStrategy(),
					],
				});

				await mcpServer.server.connect(serverTransport);
				await client.connect(clientTransport);

				const longMessage = "x".repeat(300);
				const result = await client.request(
					{
						method: "tools/call",
						params: {
							name: "check-message-length",
							arguments: {
								entries: [
									{
										strategyId: "twitter",
										message: longMessage,
									},
									{
										strategyId: "mastodon",
										message: "Short message",
									},
								],
							},
						},
					},
					CallToolResultSchema,
				);

				assert.ok(result.content);
				assert.strictEqual(result.content.length, 1);
				const responseLines = result.content[0].text.split("\n");
				assert.strictEqual(
					responseLines.length,
					2,
					"Should have two lines of response",
				);
				assert.ok(
					responseLines[0].includes(
						"❌ Message is too long for Twitter",
					),
					"Should show Twitter message is too long",
				);
				assert.ok(
					responseLines[1].includes(
						"✅ Message fits within Mastodon's character limit",
					),
					"Should show Mastodon message fits",
				);
			});

			it("should handle unknown strategies in an array of entries for check-message-length tool", async () => {
				const mcpServer = new CrosspostMcpServer({
					strategies: [
						new MockTwitterStrategy(),
						new MockMastodonStrategy(),
					],
				});

				await mcpServer.server.connect(serverTransport);
				await client.connect(clientTransport);

				const result = await client.request(
					{
						method: "tools/call",
						params: {
							name: "check-message-length",
							arguments: {
								entries: [
									{
										strategyId: "unknown-platform",
										message: "Test message 1",
									},
									{
										strategyId: "twitter",
										message: "Test message 2",
									},
								],
							},
						},
					},
					CallToolResultSchema,
				);

				assert.ok(result.content);
				assert.strictEqual(result.content.length, 1);
				const responseLines = result.content[0].text.split("\n");
				assert.strictEqual(
					responseLines.length,
					2,
					"Should have two lines of response",
				);
				assert.ok(
					responseLines[0].includes(
						"Error: Strategy with ID 'unknown-platform' not found",
					),
					"Should show error for unknown strategy",
				);
				assert.ok(
					responseLines[1].includes(
						"✅ Message fits within Twitter's character limit",
					),
					"Should show Twitter message fits",
				);
			});
		});

		describe("calculate-message-length", () => {
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
					result.content[0].text.includes(
						"Use the list-services tool",
					),
					"Should suggest using the list-services tool",
				);
			});
		});

		describe("resize-message", () => {
			it("should execute the resize-message tool and return shortening prompt", async () => {
				const mcpServer = new CrosspostMcpServer({
					strategies: [
						new MockTwitterStrategy(),
						new MockMastodonStrategy(),
					],
				});
				await mcpServer.server.connect(serverTransport);
				await client.connect(clientTransport);
				const result = await client.request(
					{
						method: "tools/call",
						params: {
							name: "resize-message",
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
				const promptText = result.content[0].text;
				assert.ok(
					promptText.includes("The character\nlimit for twitter is"),
					"Prompt should mention the strategyId",
				);
				assert.ok(
					promptText.includes("20 characters"),
					"Prompt should mention the excessLength",
				);
				assert.ok(
					promptText.includes(
						"This is a sample message that needs to be shortened",
					),
					"Prompt should include the original message",
				);
			});

			it("should execute the resize-message tool and return error for unknown strategy", async () => {
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
							name: "resize-message",
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
					result.content[0].text.includes(
						"Use the list-services tool",
					),
					"Should suggest using the list-services tool",
				);
			});
		});
	});
});
