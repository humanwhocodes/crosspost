/**
 * @fileoverview Tests for the TwitterStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Requirements
//-----------------------------------------------------------------------------

import { TwitterStrategy } from "../../src/strategies/twitter.js";
import nock from "nock";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const message = "Tweet!";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "images");

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("TwitterStrategy", () => {
	describe("constructor", () => {
		it("should throw an error when the access token key is missing", () => {
			assert.throws(() => {
				new TwitterStrategy({
					accessTokenSecret: "foo",
					apiConsumerKey: "bar",
					apiConsumerSecret: "baz",
				});
			}, /access token key/i);
		});

		it("should throw an error when the access token secret is missing", () => {
			assert.throws(() => {
				new TwitterStrategy({
					accessTokenKey: "foo",
					apiConsumerKey: "bar",
					apiConsumerSecret: "baz",
				});
			}, /access token secret/i);
		});

		it("should throw an error when the consumer key is missing", () => {
			assert.throws(() => {
				new TwitterStrategy({
					accessTokenKey: "foo",
					accessTokenSecret: "bar",
					apiConsumerSecret: "baz",
				});
			}, /consumer key/i);
		});

		it("should throw an error when the consumer secret is missing", () => {
			assert.throws(() => {
				new TwitterStrategy({
					accessTokenKey: "foo",
					accessTokenSecret: "bar",
					apiConsumerKey: "baz",
				});
			}, /consumer secret/i);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new TwitterStrategy({
				accessTokenKey: "foo",
				accessTokenSecret: "bar",
				apiConsumerKey: "baz",
				apiConsumerSecret: "qux",
			});
			assert.strictEqual(strategy.id, "twitter");
			assert.strictEqual(strategy.name, "X (formerly Twitter)");
		});
	});

	// this test fails in Bun for some reason -- investigate later
	if (!globalThis.Bun) {
		it("should send a tweet when there's a message and tokens", async () => {
			nock("https://api.x.com", {
				reqheaders: {
					authorization: /OAuth oauth_consumer_key="baz"/,
				},
			})
				.post("/2/tweets")
				.reply(200, { result: "Success!" });

			const strategy = new TwitterStrategy({
				accessTokenKey: "foo",
				accessTokenSecret: "bar",
				apiConsumerKey: "baz",
				apiConsumerSecret: "bar",
			});

			const response = await strategy.post(message);
			assert.strictEqual(response.result, "Success!");
		});

		it("should send a tweet with images when there's a message and images", async () => {
			const imagePath = path.join(FIXTURES_DIR, "smiley.png");
			const imageData = new Uint8Array(await fs.readFile(imagePath));

			// takes three calls to upload a small image

			nock("https://api.x.com")
				.post("/2/media/upload")
				.reply(200, { data: { id: "12345" } });

			nock("https://api.x.com")
				.post("/2/media/upload")
				.reply(200, { data: { id: "12345" } });

			nock("https://api.x.com")
				.post("/2/media/upload")
				.reply(200, { data: { id: "12345" } });

			nock("https://api.x.com")
				.post("/2/media/metadata")
				.reply((uri, body) => {
					assert.deepStrictEqual(body, {
						id: "12345",
						metadata: {
							alt_text: {
								text: "Test image",
							},
						},
					});
					return [200, { data: { id: "12345" } }];
				});

			nock("https://api.x.com", {
				reqheaders: {
					authorization: /OAuth oauth_consumer_key="baz"/,
				},
			})
				.post("/2/tweets")
				.reply((uri, body) => {
					assert.deepStrictEqual(body, {
						text: message,
						media: {
							media_ids: ["12345"],
						},
					});

					return [
						200,
						{
							data: {
								id: "12345",
								text: message,
							},
						},
					];
				});

			const strategy = new TwitterStrategy({
				accessTokenKey: "foo",
				accessTokenSecret: "bar",
				apiConsumerKey: "baz",
				apiConsumerSecret: "bar",
			});

			const response = await strategy.post(message, {
				images: [
					{
						data: imageData,
						alt: "Test image",
					},
				],
			});

			assert.deepStrictEqual(response.data, {
				id: "12345",
				text: message,
			});
		});

		it("should abort when signal is triggered", async () => {
			const signal = AbortSignal.abort("Aborted");

			nock("https://api.x.com", {
				reqheaders: {
					authorization: /OAuth oauth_consumer_key="baz"/,
				},
			})
				.post("/2/tweets")
				.delay(100)
				.reply(() => {
					return [200, { result: "Success!" }];
				});

			const strategy = new TwitterStrategy({
				accessTokenKey: "foo",
				accessTokenSecret: "bar",
				apiConsumerKey: "baz",
				apiConsumerSecret: "bar",
			});

			await assert.rejects(async () => {
				await strategy.post("Hello, world!", { signal });
			}, /Aborted/);
		});

		describe("getUrlFromResponse", function () {
			let strategy;

			beforeEach(function () {
				strategy = new TwitterStrategy({
					accessTokenKey: "foo",
					accessTokenSecret: "bar",
					apiConsumerKey: "baz",
					apiConsumerSecret: "bar",
				});
			});

			it("should generate the correct URL from a response", function () {
				const response = {
					data: {
						id: "1234567890",
					},
				};

				const url = strategy.getUrlFromResponse(response);
				assert.strictEqual(
					url,
					"https://x.com/i/web/status/1234567890",
				);
			});

			it("should throw an error when tweet ID is missing", function () {
				const response = {
					data: {},
				};

				assert.throws(() => {
					strategy.getUrlFromResponse(response);
				}, /Tweet ID not found in response/);
			});

			it("should throw an error when the response is null", function () {
				assert.throws(() => {
					strategy.getUrlFromResponse(null);
				}, /Tweet ID not found in response/);
			});
		});
	}

	describe("MAX_MESSAGE_LENGTH", () => {
		let strategy;
		beforeEach(() => {
			strategy = new TwitterStrategy({
				accessTokenKey: "foo",
				accessTokenSecret: "bar",
				apiConsumerKey: "baz",
				apiConsumerSecret: "qux",
			});
		});
		it("should have a MAX_MESSAGE_LENGTH property", () => {
			assert.ok(
				Object.prototype.hasOwnProperty.call(
					strategy,
					"MAX_MESSAGE_LENGTH",
				),
				"MAX_MESSAGE_LENGTH property is missing",
			);
			assert.strictEqual(typeof strategy.MAX_MESSAGE_LENGTH, "number");
		});
	});

	describe("calculateMessageLength", () => {
		let strategy;
		beforeEach(() => {
			strategy = new TwitterStrategy({
				accessTokenKey: "foo",
				accessTokenSecret: "bar",
				apiConsumerKey: "baz",
				apiConsumerSecret: "qux",
			});
		});
		it("should calculate length of plain text correctly", () => {
			const msg = "Hello world!";
			assert.strictEqual(
				strategy.calculateMessageLength(msg),
				msg.length,
			);
		});
		it("should count URLs as 23 characters", () => {
			const msg =
				"Check this out: https://example.com/abcde and http://foo.bar";
			const urlCount = 2;
			const expected =
				msg.replace(/https?:\/\/[^\s]+/g, "").length + urlCount * 23;
			assert.strictEqual(strategy.calculateMessageLength(msg), expected);
		});
	});
});
