/**
 * @fileoverview Tests for the DiscordStrategy class.
 * @author Nicholas C. Zakas
 */

/* global FormData */

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

const pngImageData = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
	0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
	0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0xff,
	0xff, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
	0x42, 0x60, 0x82,
]);

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

		it("should create an instance with correct id and name", () => {
			const strategy = new DiscordStrategy({
				botToken: BOT_TOKEN,
				channelId: CHANNEL_ID,
			});
			assert.strictEqual(strategy.id, "discord");
			assert.strictEqual(strategy.name, "Discord Bot");
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
			const payload = {
				content: message,
			};

			const formData = new FormData();
			formData.append("payload_json", JSON.stringify(payload));

			server.post(
				{
					url: `/api/v10/channels/${CHANNEL_ID}/messages`,
					headers: {
						authorization: `Bot ${BOT_TOKEN}`,
					},
					body: formData,
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

		it("should successfully post a message with images", async () => {
			const message = "Hello Discord!";
			const altText = "Test image";
			const payload = {
				content: message,
				embeds: [
					{
						description: altText,
						image: {
							url: "attachment://image1.png",
						},
					},
				],
				attachments: [
					{
						id: 0,
						description: altText,
						filename: "image1.png",
					},
				],
			};
			const formData = new FormData();
			formData.append("payload_json", JSON.stringify(payload));

			server.post(
				{
					url: `/api/v10/channels/${CHANNEL_ID}/messages`,
					headers: {
						authorization: `Bot ${BOT_TOKEN}`,
					},
					body: formData,
				},
				async request => {
					const formData = await request.formData();
					const file = formData.get("files[0]");

					assert.strictEqual(file.type, "image/png");
					assert.strictEqual(file.name, "image1.png");
					assert.deepStrictEqual(
						await file.arrayBuffer(),
						pngImageData.buffer,
					);

					return {
						status: 200,
						headers: {
							"content-type": "application/json",
						},
						body: MESSAGE_RESPONSE,
					};
				},
			);

			const result = await strategy.post(message, {
				images: [
					{
						data: pngImageData,
						alt: altText,
					},
				],
			});
			assert.deepStrictEqual(result, MESSAGE_RESPONSE);
		});

		it("should use generic alt text when none is provided", async () => {
			const message = "Hello Discord!";
			const payload = {
				content: message,
				embeds: [
					{
						description: "image1.png",
						image: {
							url: "attachment://image1.png",
						},
					},
				],
				attachments: [
					{
						id: 0,
						description: "image1.png",
						filename: "image1.png",
					},
				],
			};
			const formData = new FormData();
			formData.append("payload_json", JSON.stringify(payload));

			server.post(
				{
					url: `/api/v10/channels/${CHANNEL_ID}/messages`,
					headers: {
						authorization: `Bot ${BOT_TOKEN}`,
					},
					body: formData,
				},
				async request => {
					const formData = await request.formData();
					const file = formData.get("files[0]");

					assert.strictEqual(file.type, "image/png");
					assert.strictEqual(file.name, "image1.png");
					assert.deepStrictEqual(
						await file.arrayBuffer(),
						pngImageData.buffer,
					);

					return {
						status: 200,
						headers: {
							"content-type": "application/json",
						},
						body: MESSAGE_RESPONSE,
					};
				},
			);

			const result = await strategy.post(message, {
				images: [
					{
						data: pngImageData,
					},
				],
			});
			assert.deepStrictEqual(result, MESSAGE_RESPONSE);
		});

		it("should throw error for invalid post options", async () => {
			await assert.rejects(
				strategy.post("Hello", { images: [{ invalid: true }] }),
				/Image must have data/,
			);
		});

		it("should abort when signal is triggered", async () => {
			const message = "Hello Discord!";
			const controller = new AbortController();

			server.post(
				{
					url: `/api/v10/channels/${CHANNEL_ID}/messages`,
					headers: {
						authorization: `Bot ${BOT_TOKEN}`,
					},
				},
				{
					status: 200,
					delay: 50,
					headers: {
						"content-type": "application/json",
					},
					body: MESSAGE_RESPONSE,
				},
			);

			setTimeout(() => controller.abort(), 10);

			await assert.rejects(async () => {
				await strategy.post(message, { signal: controller.signal });
			}, /AbortError/);
		});
	});
});
