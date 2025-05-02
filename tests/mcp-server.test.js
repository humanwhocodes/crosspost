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

	async post(message) {
		return { message: `${message} (from Twitter)` };
	}

	getUrlFromResponse() {
		return "https://twitter.com/example/status/123";
	}
}

class MockMastodonStrategy {
	id = "mastodon";
	name = "Mastodon";

	async post(message) {
		if (message === "fail") {
			throw new Error("Failed to post");
		}
		return { message: `${message} (from Mastodon)` };
	}

	getUrlFromResponse() {
		return "https://mastodon.social/@example/123";
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

		it("should list tools for each strategy and one for crossposting", async () => {
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
				3,
				"Should list three tools: crosspost, post-to-twitter, post-to-mastodon",
			);
			// Check the names of the tools
			assert.strictEqual(
				result.tools[0].name,
				"crosspost",
				"First tool should be 'crosspost' for all strategies",
			);
			assert.strictEqual(
				result.tools[1].name,
				"post-to-twitter",
				"Second tool should be for the Twitter strategy",
			);
			assert.strictEqual(
				result.tools[2].name,
				"post-to-mastodon",
				"Third tool should be for the Mastodon strategy",
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
	});
});
