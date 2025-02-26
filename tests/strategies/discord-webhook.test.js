/**
 * @fileoverview Tests for the DiscordWebhookStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { DiscordWebhookStrategy } from "../../src/strategies/discord-webhook.js";
import assert from "node:assert";
import { FetchMocker, MockServer } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const WEBHOOK_URL = "https://discord.com/api/webhooks/123456789/abcdef";
const MESSAGE_RESPONSE = {
	content: "Hello Discord!",
};

const server = new MockServer("https://discord.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("DiscordWebhookStrategy", () => {
	describe("constructor", () => {
		it("should throw an error if webhookUrl is missing", () => {
			assert.throws(
				() => new DiscordWebhookStrategy({}),
				TypeError,
				"Missing webhook URL.",
			);
		});

		it("should create an instance if webhook URL is provided", () => {
			const strategy = new DiscordWebhookStrategy({
				webhookUrl: WEBHOOK_URL,
			});
			assert.strictEqual(strategy.name, "discord-webhook");
		});
	});

	describe("post()", () => {
		let strategy;

		beforeEach(() => {
			strategy = new DiscordWebhookStrategy({
				webhookUrl: WEBHOOK_URL,
			});
			fetchMocker.mockGlobal();
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an error if message is missing", async () => {
			await assert.rejects(
				strategy.post(),
				TypeError,
				"Missing message to post.",
			);
		});

		it("should successfully post a message", async () => {
			const message = "Hello Discord!";

			server.post(
				{
					url: "/api/webhooks/123456789/abcdef",
					headers: {
						"content-type": "application/json",
					},
					body: {
						content: message,
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: MESSAGE_RESPONSE,
				},
			);

			const result = await strategy.post(message);
			assert.deepStrictEqual(result, MESSAGE_RESPONSE);
		});

		it("should handle API errors", async () => {
			server.post("/api/webhooks/123456789/abcdef", {
				status: 401,
				statusText: "Unauthorized",
				body: {
					message: "Invalid Webhook Token",
					code: 50027,
				},
			});

			await assert.rejects(
				strategy.post("Hello Discord!"),
				/401 Failed to post message: Unauthorized\nInvalid Webhook Token \(code: 50027\)/,
			);
		});
	});
});
