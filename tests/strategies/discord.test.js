/**
 * @fileoverview Tests for the DiscordStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { DiscordStrategy } from "../../src/strategies/discord.js";
import assert from "node:assert";
import { FetchMocker, MockServer } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const BOT_TOKEN = "test-bot-token";
const CHANNEL_ID = "123456789";
const MESSAGE_RESPONSE = {
	id: "987654321",
	channel_id: CHANNEL_ID,
	content: "Hello Discord!",
};

const server = new MockServer("https://discord.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("DiscordStrategy", () => {
	describe("constructor", () => {
		it("should throw an error if botToken is missing", () => {
			assert.throws(
				() => new DiscordStrategy({ channelId: CHANNEL_ID }),
				TypeError,
				"Missing bot token.",
			);
		});

		it("should throw an error if channelId is missing", () => {
			assert.throws(
				() => new DiscordStrategy({ botToken: BOT_TOKEN }),
				TypeError,
				"Missing channel ID.",
			);
		});

		it("should create an instance if all options are provided", () => {
			const strategy = new DiscordStrategy({
				botToken: BOT_TOKEN,
				channelId: CHANNEL_ID,
			});
			assert.strictEqual(strategy.name, "discord");
		});
	});

	describe("post", () => {
		let strategy;

		beforeEach(() => {
			strategy = new DiscordStrategy({
				botToken: BOT_TOKEN,
				channelId: CHANNEL_ID,
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
					url: `/api/v10/channels/${CHANNEL_ID}/messages`,
					headers: {
						authorization: `Bot ${BOT_TOKEN}`,
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
			server.post(`/api/v10/channels/${CHANNEL_ID}/messages`, {
				status: 401,
				statusText: "Unauthorized",
				body: {
					message: "No good",
					code: 123,
				},
			});

			await assert.rejects(
				strategy.post("Hello Discord!"),
				/401 Failed to post message: Unauthorized\nNo good \(code: 123\)/,
			);
		});
	});
});
