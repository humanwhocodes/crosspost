/**
 * @fileoverview Tests for the TelegramStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { TelegramStrategy } from "../../src/strategies/telegram.js";
import assert from "node:assert";
import { FetchMocker, MockServer } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const BOT_TOKEN = "test-bot-token";
const CHAT_ID = "123456789";
const MESSAGE_RESPONSE = {
	ok: true,
	result: {
		message_id: 456,
		chat: {
			id: CHAT_ID,
			type: "private",
		},
		text: "Hello Telegram!",
	},
};

const server = new MockServer("https://api.telegram.org");
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

describe("TelegramStrategy", () => {
	describe("constructor", () => {
		it("should throw an error if botToken is missing", () => {
			assert.throws(
				() => new TelegramStrategy({}),
				TypeError,
				"Missing bot token.",
			);
		});

		it("should throw an error if chatId is missing", () => {
			assert.throws(
				() => new TelegramStrategy({ botToken: BOT_TOKEN }),
				TypeError,
				"Missing chat ID.",
			);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new TelegramStrategy({
				botToken: BOT_TOKEN,
				chatId: CHAT_ID,
			});
			assert.strictEqual(strategy.id, "telegram");
			assert.strictEqual(strategy.name, "Telegram");
		});
	});

	describe("post", () => {
		let strategy;

		beforeEach(() => {
			strategy = new TelegramStrategy({
				botToken: BOT_TOKEN,
				chatId: CHAT_ID,
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
			const message = "Hello Telegram!";

			server.post(
				{
					url: `/bot${BOT_TOKEN}/sendMessage`,
					body: {
						chat_id: CHAT_ID,
						text: message,
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
			server.post(
				{
					url: `/bot${BOT_TOKEN}/sendMessage`,
					body: {
						chat_id: CHAT_ID,
						text: "Hello Telegram!",
					},
				},
				{
					status: 401,
					statusText: "Unauthorized",
					body: {
						ok: false,
						error_code: 401,
						description: "Unauthorized",
					},
				},
			);

			await assert.rejects(
				strategy.post("Hello Telegram!"),
				/401 Failed to post message: Unauthorized\nUnauthorized \(code: 401\)/,
			);
		});

		it("should successfully post a message with images", async () => {
			const message = "Hello Telegram!";
			const altText = "Test image";

			// Mock the sendMessage API call for text
			server.post(
				{
					url: `/bot${BOT_TOKEN}/sendMessage`,
					body: {
						chat_id: CHAT_ID,
						text: message,
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

			// Mock the sendPhoto API call for image
			server.post(
				{
					url: `/bot${BOT_TOKEN}/sendPhoto`,
				},
				async request => {
					const formData = await request.formData();
					const photo = formData.get("photo");
					const chatId = formData.get("chat_id");
					const caption = formData.get("caption");

					assert.strictEqual(chatId, CHAT_ID);
					assert.strictEqual(caption, altText);
					assert.strictEqual(photo.type, "image/png");

					return {
						status: 200,
						headers: {
							"content-type": "application/json",
						},
						body: {
							ok: true,
							result: {
								message_id: 457,
								chat: {
									id: CHAT_ID,
									type: "private",
								},
								photo: [
									{
										file_id: "test-file-id",
										file_unique_id: "test-unique-id",
										width: 1,
										height: 1,
										file_size: 100,
									},
								],
								caption: altText,
							},
						},
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

			// The result should be the text message response
			assert.deepStrictEqual(result, MESSAGE_RESPONSE);
		});

		it("should throw error for invalid post options", async () => {
			await assert.rejects(
				strategy.post("Hello", { images: [{ invalid: true }] }),
				/Image must have data/,
			);
		});

		it("should abort when signal is triggered", async () => {
			const message = "Hello Telegram!";
			const controller = new AbortController();

			server.post(
				{
					url: `/bot${BOT_TOKEN}/sendMessage`,
					body: {
						chat_id: CHAT_ID,
						text: message,
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
