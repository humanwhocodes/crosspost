/**
 * @fileoverview Tests for the Client class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { strict as assert } from "node:assert";
import { Client, SuccessResponse, FailureResponse } from "../src/client.js";

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("Client", function () {
	describe("constructor", function () {
		it("should throw a TypeError if strategies are missing", function () {
			assert.throws(
				() => {
					new Client({});
				},
				TypeError,
				"strategies must be an array.",
			);
		});

		it("should throw a TypeError if strategies is not an array", function () {
			assert.throws(
				() => {
					new Client({ strategies: "not an array" });
				},
				TypeError,
				"strategies must be an array.",
			);
		});

		it("should create an instance if strategies is an array", function () {
			const strategies = [{ name: "test", post() {} }];
			new Client({ strategies });
		});
	});

	describe("post", function () {
		it("should call post on each strategy", async function () {
			const url1 = "https://example.com/strategy1";

			const strategies = [
				{
					name: "test1",
					post() {
						return Promise.resolve("test1");
					},
					getUrlFromResponse() {
						return url1;
					},
				},
				{
					name: "test2",
					post() {
						return Promise.resolve("test2");
					},
				},
			];

			const client = new Client({ strategies });
			const response = await client.post("Hello, world!");

			assert.deepStrictEqual(response, [
				new SuccessResponse("test1", "test1", url1),
				new SuccessResponse("test2", "test2"),
			]);
		});

		it("should return failure response one strategy fails", async function () {
			const strategies = [
				{
					name: "test1",
					post() {
						return Promise.resolve("test1");
					},
				},
				{
					name: "test2",
					post() {
						return Promise.reject(new Error("test2"));
					},
					getUrlFromResponse() {
						assert.fail(
							"getUrlForResponse should not be called on failure",
						);
					},
				},
			];

			const client = new Client({ strategies });
			const results = await client.post("Hello, world!");

			assert.deepStrictEqual(results, [
				new SuccessResponse("test1", "test1"),
				new FailureResponse("test2", new Error("test2")),
			]);
		});

		it("should return failure responses when all strategies fail", async function () {
			const strategies = [
				{
					name: "test1",
					post() {
						return Promise.reject(new Error("test1"));
					},
				},
				{
					name: "test2",
					post() {
						return Promise.reject(new Error("test2"));
					},
				},
			];

			const client = new Client({ strategies });
			const results = await client.post("Hello, world!");

			assert.deepStrictEqual(results, [
				new FailureResponse("test1", new Error("test1")),
				new FailureResponse("test2", new Error("test2")),
			]);
		});

		it("should pass signal to each strategy", async () => {
			const controller = new AbortController();
			const signals = [];

			const strategies = [
				{
					name: "test1",
					post(message, options) {
						signals.push(options?.signal);
						return Promise.resolve();
					},
				},
				{
					name: "test2",
					post(message, options) {
						signals.push(options?.signal);
						return Promise.resolve();
					},
				},
			];

			const client = new Client({ strategies });
			await client.post("Hello", { signal: controller.signal });

			assert.strictEqual(signals.length, 2);
			assert.ok(signals[0] instanceof AbortSignal);
			assert.ok(signals[1] instanceof AbortSignal);
		});

		it("should abort when signal is triggered", async () => {
			const controller = new AbortController();
			const aborted = [];

			const strategies = [
				{
					name: "test1",
					async post(message, options) {
						try {
							await new Promise((resolve, reject) => {
								options?.signal?.addEventListener("abort", () =>
									reject(new Error("Aborted")),
								);
								setTimeout(resolve, 100);
							});
						} catch (error) {
							aborted.push("strategy1");
							throw error;
						}
					},
				},
				{
					name: "test2",
					async post(message, options) {
						try {
							await new Promise((resolve, reject) => {
								options?.signal?.addEventListener("abort", () =>
									reject(new Error("Aborted")),
								);
								setTimeout(resolve, 100);
							});
						} catch (error) {
							aborted.push("strategy2");
							throw error;
						}
					},
				},
			];

			const client = new Client({ strategies });
			setTimeout(() => controller.abort(), 10);

			const responses = await client.post("Hello", {
				signal: controller.signal,
			});

			assert.deepStrictEqual(aborted, ["strategy1", "strategy2"]);
			assert.strictEqual(responses.length, 2);
			assert.ok(responses[0] instanceof FailureResponse);
			assert.ok(responses[1] instanceof FailureResponse);
			assert.match(responses[0].reason.message, /Aborted/);
			assert.match(responses[1].reason.message, /Aborted/);
			assert.strictEqual(responses[0].name, "test1");
			assert.strictEqual(responses[1].name, "test2");
		});
	});
});
