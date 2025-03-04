/**
 * @fileoverview Tests for the XStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { XStrategy } from "../../src/strategies/x.js";
import { MockServer, FetchMocker } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const POST_TWEET_URL = "/2/tweets";

const CREATE_TWEET_RESPONSE = {
	data: {
		id: "1234567890",
		text: "Hello, world!",
	},
};

const server = new MockServer("https://api.x.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("XStrategy", () => {
	let options;

	beforeEach(() => {
		options = {
			accessToken: "test-token",
		};
	});

	describe("constructor", () => {
		it("should throw a TypeError if access token is missing", () => {
			assert.throws(
				() => {
					new XStrategy({ ...options, accessToken: undefined });
				},
				TypeError,
				"Missing access token.",
			);
		});

		it("should create an instance if all options are provided", () => {
			const strategy = new XStrategy(options);
			assert.strictEqual(strategy.name, "x");
		});
	});

	describe("post", () => {
		let strategy;

		beforeEach(() => {
			strategy = new XStrategy(options);
			fetchMocker.mockGlobal();
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an Error if message is missing", async () => {
			await assert.rejects(
				async () => {
					await strategy.post();
				},
				TypeError,
				"Missing message to post.",
			);
		});

		it("should successfully post a message", async () => {
			const text = "Hello, world!";

			server.post(
				{
					url: POST_TWEET_URL,
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${options.accessToken}`,
					},
					body: {
						text,
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_TWEET_RESPONSE,
				},
			);

			const response = await strategy.post(text);
			assert.deepStrictEqual(response, CREATE_TWEET_RESPONSE);
		});

		it("should handle post tweet request failure", async () => {
			server.post(POST_TWEET_URL, {
				status: 401,
				body: {
					errors: [
						{
							message: "Invalid token",
						},
					],
				},
			});

			await assert.rejects(async () => {
				await strategy.post("Hello, world!");
			}, /Invalid token/);
		});
	});
});
