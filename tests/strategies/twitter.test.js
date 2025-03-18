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

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const message = "Tweet!";

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

		it.only("should send a tweet with images when there's a message and images", async () => {
			const imageData = new Uint8Array([1, 2, 3, 4]);

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
	}
});
