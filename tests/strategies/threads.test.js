/**
 * @fileoverview Tests for the ThreadsStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { ThreadsStrategy } from "../../src/strategies/threads.js";
import { MockServer, FetchMocker } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const ACCESS_TOKEN = "test-token-123";
const INSTAGRAM_ID = "17841234567890";
const API_VERSION = "v22.0";

const server = new MockServer("https://graph.facebook.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("ThreadsStrategy", () => {
	describe("constructor", () => {
		it("should throw a TypeError if access token is missing", () => {
			assert.throws(
				() => {
					new ThreadsStrategy({ instagramId: INSTAGRAM_ID });
				},
				TypeError,
				"Missing access token.",
			);
		});

		it("should throw a TypeError if Instagram ID is missing", () => {
			assert.throws(
				() => {
					new ThreadsStrategy({ accessToken: ACCESS_TOKEN });
				},
				TypeError,
				"Missing Instagram ID.",
			);
		});

		it("should create an instance if all required options are provided", () => {
			const strategy = new ThreadsStrategy({
				accessToken: ACCESS_TOKEN,
				instagramId: INSTAGRAM_ID,
			});
			assert.strictEqual(strategy.name, "threads");
		});
	});

	describe("post", () => {
		let strategy;

		beforeEach(() => {
			strategy = new ThreadsStrategy({
				accessToken: ACCESS_TOKEN,
				instagramId: INSTAGRAM_ID,
			});
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
			const text = "Hello, Threads!";
			const expectedResponse = { id: "12345" };

			server.post(
				{
					url: `/${API_VERSION}/${INSTAGRAM_ID}/threads`,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
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
					body: expectedResponse,
				},
			);

			const response = await strategy.post(text);
			assert.deepStrictEqual(response, expectedResponse);
		});

		it("should handle post request failure", async () => {
			const text = "Hello, Threads!";
			const errorResponse = {
				error: {
					message: "Invalid OAuth access token.",
					type: "OAuthException",
					code: 190,
				},
			};

			server.post(
				{
					url: `/${API_VERSION}/${INSTAGRAM_ID}/threads`,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
					},
					body: {
						text,
					},
				},
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
					body: errorResponse,
				},
			);

			await assert.rejects(
				async () => {
					await strategy.post(text);
				},
				{
					message:
						"401 Failed to create post: Invalid OAuth access token.",
				},
			);
		});
	});
});
