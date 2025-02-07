/**
 * @fileoverview Tests for the MastodonStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { MastodonStrategy } from "../../src/strategies/mastodon.js";
import assert from "node:assert";
import { FetchMocker, MockServer } from "mentoss";

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("MastodonStrategy", () => {
	describe("constructor", () => {
		it("should throw an error if accessToken is missing", () => {
			assert.throws(
				() => new MastodonStrategy({ host: "mastodon.social" }),
				TypeError,
				"Missing Mastodon access token.",
			);
		});

		it("should throw an error if host is missing", () => {
			assert.throws(
				() => new MastodonStrategy({ accessToken: "token" }),
				TypeError,
				"Missing Mastodon host.",
			);
		});

		it("should create an instance if both accessToken and host are provided", () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			assert(instance instanceof MastodonStrategy);
		});
	});

	describe("post", () => {
		const server = new MockServer("https://mastodon.social");
		const fetchMocker = new FetchMocker({
			servers: [server],
		});

		beforeEach(() => {
			fetchMocker.mockGlobal(fetchMocker.fetch);
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an error if message is missing", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			await assert.rejects(instance.post(), {
				name: "Error",
				message: "Missing message to toot.",
			});
		});

		it("should make a POST request to the correct URL", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			const message = "Hello, Mastodon!";
			const response = { id: "12345" };

			server.post(
				{
					url: "/api/v1/statuses",
					request: {
						headers: {
							authorization: "Bearer token",
						},
						body: {
							status: message,
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: response,
				},
			);

			const result = await instance.post(message);
			assert.deepStrictEqual(result, { id: "12345" });
		});

		it("should handle fetch errors", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			const message = "Hello, Mastodon!";

			server.post(
				{
					url: "/api/v1/statuses",
					request: {
						headers: {
							authorization: "Bearer token",
						},
						body: {
							status: message,
						},
					},
				},
				401,
			);

			await assert.rejects(instance.post(message), {
				name: "Error",
				message: "Failed to post message: 401 Unauthorized",
			});
		});
	});
});
