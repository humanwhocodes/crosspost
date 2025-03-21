/**
 * @fileoverview Tests for the DiscordWebhookStrategy class.
 * @author Nicholas C. Zakas
 */

/* global FormData */

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
			const payload = {
				content: message,
			};
			const formData = new FormData();
			formData.append("payload_json", JSON.stringify(payload));

			server.post(
				{
					url: "/api/webhooks/123456789/abcdef",
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

		it("should successfully post a message with images", async () => {
			const message = "Hello Discord!";
			const imageData = new Uint8Array([
				// PNG signature
				0x89,
				0x50,
				0x4e,
				0x47,
				0x0d,
				0x0a,
				0x1a,
				0x0a,
				// IHDR chunk
				0x00,
				0x00,
				0x00,
				0x0d, // Length
				0x49,
				0x48,
				0x44,
				0x52, // "IHDR"
				0x00,
				0x00,
				0x00,
				0x01, // Width: 1
				0x00,
				0x00,
				0x00,
				0x01, // Height: 1
				0x08, // Bit depth
				0x06, // Color type: RGBA
				0x00, // Compression
				0x00, // Filter
				0x00, // Interlace
				0x1f,
				0x15,
				0xc4,
				0x89, // IHDR CRC
				// IDAT chunk
				0x00,
				0x00,
				0x00,
				0x0a, // Length
				0x49,
				0x44,
				0x41,
				0x54, // "IDAT"
				0x78,
				0x9c,
				0x63,
				0x00, // zlib header + data
				0x00,
				0x00,
				0x00,
				0xff, // zlib checksum
				0xff,
				0x00,
				0x02,
				0x00, // IDAT CRC
				// IEND chunk
				0x00,
				0x00,
				0x00,
				0x00, // Length
				0x49,
				0x45,
				0x4e,
				0x44, // "IEND"
				0xae,
				0x42,
				0x60,
				0x82, // IEND CRC
			]);
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
			// formData.append("files[0]", new File([imageData], "image1.png", { type: "image/png" }));

			server.post(
				{
					url: "/api/webhooks/123456789/abcdef",
					body: formData,
				},
				async request => {
					const formData = await request.formData();
					const file = formData.get("files[0]");

					assert.strictEqual(file.type, "image/png");
					assert.strictEqual(file.name, "image1.png");
					assert.deepStrictEqual(await file.bytes(), imageData);

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
						data: imageData,
						alt: altText,
					},
				],
			});
			assert.deepStrictEqual(result, MESSAGE_RESPONSE);
		});

		it("should use generic alt text when none is provided", async () => {
			const message = "Hello Discord!";
			const imageData = new Uint8Array([
				// PNG signature
				0x89,
				0x50,
				0x4e,
				0x47,
				0x0d,
				0x0a,
				0x1a,
				0x0a,
				// IHDR chunk
				0x00,
				0x00,
				0x00,
				0x0d, // Length
				0x49,
				0x48,
				0x44,
				0x52, // "IHDR"
				0x00,
				0x00,
				0x00,
				0x01, // Width: 1
				0x00,
				0x00,
				0x00,
				0x01, // Height: 1
				0x08, // Bit depth
				0x06, // Color type: RGBA
				0x00, // Compression
				0x00, // Filter
				0x00, // Interlace
				0x1f,
				0x15,
				0xc4,
				0x89, // IHDR CRC
				// IDAT chunk
				0x00,
				0x00,
				0x00,
				0x0a, // Length
				0x49,
				0x44,
				0x41,
				0x54, // "IDAT"
				0x78,
				0x9c,
				0x63,
				0x00, // zlib header + data
				0x00,
				0x00,
				0x00,
				0xff, // zlib checksum
				0xff,
				0x00,
				0x02,
				0x00, // IDAT CRC
				// IEND chunk
				0x00,
				0x00,
				0x00,
				0x00, // Length
				0x49,
				0x45,
				0x4e,
				0x44, // "IEND"
				0xae,
				0x42,
				0x60,
				0x82, // IEND CRC
			]);
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
					url: "/api/webhooks/123456789/abcdef",
					body: formData,
				},
				async request => {
					const formData = await request.formData();
					const file = formData.get("files[0]");

					assert.strictEqual(file.type, "image/png");
					assert.strictEqual(file.name, "image1.png");
					assert.deepStrictEqual(await file.bytes(), imageData);

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
						data: imageData,
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
	});
});
