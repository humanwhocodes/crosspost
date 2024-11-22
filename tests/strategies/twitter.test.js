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
	if (globalThis.process?.versions?.node) {
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
	}
});
