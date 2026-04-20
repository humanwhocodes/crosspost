/**
 * @fileoverview Tests for the RedditStrategy class.
 * @author Nicholas C. Zakas
 */

/* global TextDecoder */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { RedditStrategy } from "../../src/strategies/reddit.js";
import { FetchMocker, MockServer } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const ACCESS_TOKEN = "test-access-token";
const SUBREDDIT = "javascript";
const server = new MockServer("https://oauth.reddit.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

const SUBMIT_RESPONSE = {
	json: {
		errors: [],
		data: {
			url: "https://reddit.com/r/javascript/comments/abc123/hello_reddit/",
			permalink: "/r/javascript/comments/abc123/hello_reddit/",
		},
	},
};

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("RedditStrategy", () => {
	describe("constructor", () => {
		it("should throw a TypeError if access token is missing", () => {
			assert.throws(
				() => {
					new RedditStrategy({ subreddit: SUBREDDIT });
				},
				TypeError,
				"Missing access token.",
			);
		});

		it("should throw a TypeError if subreddit is missing", () => {
			assert.throws(
				() => {
					new RedditStrategy({ accessToken: ACCESS_TOKEN });
				},
				TypeError,
				"Missing subreddit.",
			);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new RedditStrategy({
				accessToken: ACCESS_TOKEN,
				subreddit: SUBREDDIT,
			});
			assert.strictEqual(strategy.id, "reddit");
			assert.strictEqual(strategy.name, "Reddit");
		});
	});

	describe("post", () => {
		let strategy;

		beforeEach(() => {
			strategy = new RedditStrategy({
				accessToken: ACCESS_TOKEN,
				subreddit: SUBREDDIT,
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
			const message = "Hello Reddit!\nThis is a test post.";
			const body =
				"api_type=json&kind=self&sr=javascript&title=Hello+Reddit%21&text=This+is+a+test+post.&resubmit=true";

			server.post(
				{
					url: "/api/submit",
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/x-www-form-urlencoded",
					},
				},
				async request => {
					const requestBody = new TextDecoder().decode(
						await request.arrayBuffer(),
					);
					assert.strictEqual(requestBody, body);

					return {
						status: 200,
						headers: {
							"content-type": "application/json",
						},
						body: SUBMIT_RESPONSE,
					};
				},
			);

			const response = await strategy.post(message);
			assert.deepStrictEqual(response, SUBMIT_RESPONSE);
		});

		it("should handle API errors", async () => {
			server.post("/api/submit", {
				status: 403,
				statusText: "Forbidden",
				body: {
					json: {
						errors: [["RATELIMIT", "Try again in 6 minutes.", "ratelimit"]],
					},
				},
			});

			await assert.rejects(
				async () => {
					await strategy.post("Hello Reddit!");
				},
				/403 Failed to submit post: Forbidden\nRATELIMIT: Try again in 6 minutes.: ratelimit/,
			);
		});

		it("should handle API validation errors", async () => {
			server.post("/api/submit", {
				status: 200,
				body: {
					json: {
						errors: [["SUBREDDIT_NOEXIST", "that subreddit does not exist", "sr"]],
					},
				},
			});

			await assert.rejects(
				async () => {
					await strategy.post("Hello Reddit!");
				},
				/Failed to submit post:\nSUBREDDIT_NOEXIST: that subreddit does not exist: sr/,
			);
		});

		it("should throw an error for unsupported images", async () => {
			await assert.rejects(
				async () => {
					await strategy.post("Hello", {
						images: [{ data: new Uint8Array([1, 2, 3]) }],
					});
				},
				/Images are not supported in Reddit text posts./,
			);
		});

		it("should abort when signal is triggered", async () => {
			const controller = new AbortController();
			const message = "Hello Reddit!\nThis is a test post.";

			server.post(
				{
					url: "/api/submit",
				},
				{
					status: 200,
					delay: 50,
					headers: {
						"content-type": "application/json",
					},
					body: SUBMIT_RESPONSE,
				},
			);

			setTimeout(() => controller.abort(), 10);

			await assert.rejects(async () => {
				await strategy.post(message, { signal: controller.signal });
			}, /AbortError/);
		});
	});

	describe("getUrlFromResponse", () => {
		let strategy;

		beforeEach(() => {
			strategy = new RedditStrategy({
				accessToken: ACCESS_TOKEN,
				subreddit: SUBREDDIT,
			});
		});

		it("should return the absolute URL when available", () => {
			const url = strategy.getUrlFromResponse(SUBMIT_RESPONSE);
			assert.strictEqual(
				url,
				"https://reddit.com/r/javascript/comments/abc123/hello_reddit/",
			);
		});

		it("should prepend reddit.com for permalinks", () => {
			const url = strategy.getUrlFromResponse({
				json: {
					errors: [],
					data: {
						permalink: "/r/javascript/comments/abc123/hello_reddit/",
					},
				},
			});

			assert.strictEqual(
				url,
				"https://reddit.com/r/javascript/comments/abc123/hello_reddit/",
			);
		});

		it("should throw when URL data is missing", () => {
			assert.throws(() => {
				strategy.getUrlFromResponse({
					json: {
						errors: [],
						data: {},
					},
				});
			}, /Post URL not found in response/);
		});
	});

	describe("MAX_MESSAGE_LENGTH", () => {
		let strategy;
		beforeEach(() => {
			strategy = new RedditStrategy({
				accessToken: ACCESS_TOKEN,
				subreddit: SUBREDDIT,
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
			strategy = new RedditStrategy({
				accessToken: ACCESS_TOKEN,
				subreddit: SUBREDDIT,
			});
		});
		it("should calculate length of plain text correctly", () => {
			const msg = "Hello world!";
			assert.strictEqual(
				strategy.calculateMessageLength(msg),
				msg.length,
			);
		});
		it("should count URLs as their actual length", () => {
			const msg =
				"Check this out: https://example.com/abcde and http://foo.bar";
			assert.strictEqual(
				strategy.calculateMessageLength(msg),
				[...msg].length,
			);
		});
	});
});
