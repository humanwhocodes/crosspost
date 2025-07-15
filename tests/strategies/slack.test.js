/**
 * @fileoverview Tests for SlackStrategy
 */

/* global FormData */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { strict as assert } from "assert";
import { SlackStrategy } from "../../src/strategies/slack.js";
import { FetchMocker, MockServer } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const BOT_TOKEN = "xoxb-1234567890-1234567890-ABCDEFGHIJKLMNOPQRSTUVWX";
const CHANNEL_ID = "C1234567890";
const MESSAGE_RESPONSE = {
	ok: true,
	channel: CHANNEL_ID,
	ts: "1234567890.123456",
	message: {
		text: "Hello, Slack!",
		user: "U1234567890",
		ts: "1234567890.123456",
	},
};

const server = new MockServer("https://slack.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

const pngImageData = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("SlackStrategy", function () {
	describe("constructor", function () {
		it("should throw a TypeError if botToken is missing", function () {
			assert.throws(
				() => {
					new SlackStrategy({
						channel: CHANNEL_ID,
					});
				},
				{
					name: "TypeError",
					message: "Missing bot token.",
				},
			);
		});

		it("should throw a TypeError if channel is missing", function () {
			assert.throws(
				() => {
					new SlackStrategy({
						botToken: BOT_TOKEN,
					});
				},
				{
					name: "TypeError",
					message: "Missing channel.",
				},
			);
		});

		it("should create an instance with correct id and name", function () {
			const strategy = new SlackStrategy({
				botToken: BOT_TOKEN,
				channel: CHANNEL_ID,
			});

			assert.strictEqual(strategy.id, "slack");
			assert.strictEqual(strategy.name, "Slack");
		});
	});

	describe("post", function () {
		let strategy;

		beforeEach(function () {
			strategy = new SlackStrategy({
				botToken: BOT_TOKEN,
				channel: CHANNEL_ID,
			});
			fetchMocker.mockGlobal();
		});

		afterEach(function () {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an Error if message is missing", async function () {
			await assert.rejects(strategy.post(""), {
				name: "TypeError",
				message: "Missing message to post.",
			});
		});

		it("should successfully post a message", async function () {
			server.post("/api/chat.postMessage", {
				status: 200,
				body: MESSAGE_RESPONSE,
			});

			const result = await strategy.post("Hello, Slack!");

			assert.deepStrictEqual(result, MESSAGE_RESPONSE);
		});

		it("should handle post message request failure", async function () {
			server.post("/api/chat.postMessage", {
				status: 500,
				body: "Internal Server Error",
			});

			await assert.rejects(strategy.post("Hello, Slack!"), {
				name: "Error",
				message: "500 Failed to post message: Internal Server Error",
			});
		});

		it("should handle Slack API error response", async function () {
			const errorResponse = {
				ok: false,
				error: "channel_not_found",
			};

			server.post("/api/chat.postMessage", {
				status: 200,
				body: errorResponse,
			});

			await assert.rejects(strategy.post("Hello, Slack!"), {
				name: "Error",
				message: "Failed to post message: channel_not_found",
			});
		});

		it("should throw a TypeError if images is not an array", async function () {
			await assert.rejects(
				strategy.post("Hello, Slack!", { images: "not-an-array" }),
				{
					name: "TypeError",
					message: "images must be an array.",
				},
			);
		});

		it("should throw a TypeError if image is missing data", async function () {
			await assert.rejects(
				strategy.post("Hello, Slack!", { images: [{}] }),
				{
					name: "TypeError",
					message: "Image must have data.",
				},
			);
		});

		it("should throw a TypeError if image data is not a Uint8Array", async function () {
			await assert.rejects(
				strategy.post("Hello, Slack!", {
					images: [{ data: "not-a-uint8array" }],
				}),
				{
					name: "TypeError",
					message: "Image data must be a Uint8Array.",
				},
			);
		});

		it("should successfully post a message with an image and alt text", async function () {
			const uploadUrlResponse = {
				ok: true,
				upload_url: "https://files.slack.com/upload/v1/ABCD1234",
				file_id: "F1234567890",
			};

			const completeUploadResponse = {
				ok: true,
				files: [
					{
						id: "F1234567890",
						title: "image1.png",
						permalink:
							"https://files.slack.com/files-pri/T1234567890-F1234567890/image1.png",
					},
				],
			};

			const messageResponse = {
				ok: true,
				channel: CHANNEL_ID,
				ts: "1234567890.123456",
				message: {
					text: "Hello, Slack!\n\nhttps://files.slack.com/files-pri/T1234567890-F1234567890/image1.png",
					user: "U1234567890",
					ts: "1234567890.123456",
				},
			};

			const form = new FormData();
			form.append("filename", "image1.png");
			form.append("length", pngImageData.length);
			form.append("alt_text", "Test image");

			// Step 1: Get upload URL
			server.post(
				{
					url: "/api/files.getUploadURLExternal",
					body: form,
				},
				{
					status: 200,
					body: uploadUrlResponse,
				},
			);

			// Step 2: Upload to external URL (mocked)
			server.post("https://files.slack.com/upload/v1/ABCD1234", {
				status: 200,
				body: "",
			});

			// Step 3: Complete upload
			server.post("/api/files.completeUploadExternal", {
				status: 200,
				body: completeUploadResponse,
			});

			server.post("/api/chat.postMessage", {
				status: 200,
				body: messageResponse,
			});

			const result = await strategy.post("Hello, Slack!", {
				images: [{ data: pngImageData, alt: "Test image" }],
			});

			assert.deepStrictEqual(result, messageResponse);
		});

		it("should handle image upload failure", async function () {
			server.post("/api/files.getUploadURLExternal", {
				status: 500,
				body: "Internal Server Error",
			});

			await assert.rejects(
				strategy.post("Hello, Slack!", {
					images: [{ data: pngImageData, alt: "Test image" }],
				}),
				{
					name: "Error",
					message:
						"500 Failed to get upload URL: Internal Server Error",
				},
			);
		});

		it("should handle image upload API error response", async function () {
			const errorResponse = {
				ok: false,
				error: "invalid_auth",
			};

			server.post("/api/files.getUploadURLExternal", {
				status: 200,
				body: errorResponse,
			});

			await assert.rejects(
				strategy.post("Hello, Slack!", {
					images: [{ data: pngImageData, alt: "Test image" }],
				}),
				{
					name: "Error",
					message: "Failed to get upload URL: invalid_auth",
				},
			);
		});

		it("should handle file upload to external URL failure", async function () {
			const uploadUrlResponse = {
				ok: true,
				upload_url: "https://files.slack.com/upload/v1/ABCD1234",
				file_id: "F1234567890",
			};

			server.post("/api/files.getUploadURLExternal", {
				status: 200,
				body: uploadUrlResponse,
			});

			server.post("https://files.slack.com/upload/v1/ABCD1234", {
				status: 400,
				body: "Bad Request",
			});

			await assert.rejects(
				strategy.post("Hello, Slack!", {
					images: [{ data: pngImageData, alt: "Test image" }],
				}),
				{
					name: "Error",
					message: "400 Failed to upload file: Bad Request",
				},
			);
		});

		it("should handle upload completion failure", async function () {
			const uploadUrlResponse = {
				ok: true,
				upload_url: "https://files.slack.com/upload/v1/ABCD1234",
				file_id: "F1234567890",
			};

			server.post("/api/files.getUploadURLExternal", {
				status: 200,
				body: uploadUrlResponse,
			});

			server.post("https://files.slack.com/upload/v1/ABCD1234", {
				status: 200,
				body: "",
			});

			server.post("/api/files.completeUploadExternal", {
				status: 500,
				body: "Internal Server Error",
			});

			await assert.rejects(
				strategy.post("Hello, Slack!", {
					images: [{ data: pngImageData, alt: "Test image" }],
				}),
				{
					name: "Error",
					message:
						"500 Failed to complete upload: Internal Server Error",
				},
			);
		});

		it("should handle upload completion API error response", async function () {
			const uploadUrlResponse = {
				ok: true,
				upload_url: "https://files.slack.com/upload/v1/ABCD1234",
				file_id: "F1234567890",
			};

			const errorResponse = {
				ok: false,
				error: "channel_not_found",
			};

			server.post("/api/files.getUploadURLExternal", {
				status: 200,
				body: uploadUrlResponse,
			});

			server.post("https://files.slack.com/upload/v1/ABCD1234", {
				status: 200,
				body: "",
			});

			server.post("/api/files.completeUploadExternal", {
				status: 200,
				body: errorResponse,
			});

			await assert.rejects(
				strategy.post("Hello, Slack!", {
					images: [{ data: pngImageData, alt: "Test image" }],
				}),
				{
					name: "Error",
					message: "Failed to complete upload: channel_not_found",
				},
			);
		});

		it("should abort when signal is triggered", async function () {
			const controller = new AbortController();
			const signal = controller.signal;

			server.post("/api/chat.postMessage", {
				status: 200,
				body: MESSAGE_RESPONSE,
				delay: 100,
			});

			const promise = strategy.post("Hello, Slack!", { signal });

			// Abort the request after a short delay
			setTimeout(() => controller.abort(), 50);

			await assert.rejects(promise, {
				name: "AbortError",
			});
		});
	});

	describe("getUrlFromResponse", function () {
		it("should generate the correct URL from a response", function () {
			const strategy = new SlackStrategy({
				botToken: BOT_TOKEN,
				channel: CHANNEL_ID,
			});

			const response = {
				ok: true,
				channel: CHANNEL_ID,
				ts: "1234567890.123456",
				message: {
					text: "Hello, Slack!",
					user: "U1234567890",
					ts: "1234567890.123456",
				},
			};

			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(
				url,
				"https://slack.com/app_redirect?channel=C1234567890&message_ts=1234567890.123456",
			);
		});
	});

	describe("MAX_MESSAGE_LENGTH", function () {
		it("should have a MAX_MESSAGE_LENGTH property", function () {
			const strategy = new SlackStrategy({
				botToken: BOT_TOKEN,
				channel: CHANNEL_ID,
			});

			assert.strictEqual(strategy.MAX_MESSAGE_LENGTH, 4000);
		});
	});

	describe("calculateMessageLength", function () {
		it("should calculate length of plain text correctly", function () {
			const strategy = new SlackStrategy({
				botToken: BOT_TOKEN,
				channel: CHANNEL_ID,
			});

			const message = "Hello, Slack!";
			const length = strategy.calculateMessageLength(message);
			assert.strictEqual(length, 13);
		});

		it("should count emojis correctly", function () {
			const strategy = new SlackStrategy({
				botToken: BOT_TOKEN,
				channel: CHANNEL_ID,
			});

			const message = "Hello 👋 World 🌍";
			const length = strategy.calculateMessageLength(message);
			assert.strictEqual(length, 15);
		});
	});
});
