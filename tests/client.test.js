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

	describe("postTo", function () {
		it("should throw a TypeError if entries is not an array", function () {
			const strategies = [{ name: "test", id: "test1", post() {} }];
			const client = new Client({ strategies });

			assert.rejects(
				async () => {
					await client.postTo("not an array");
				},
				TypeError,
				"Expected an array argument.",
			);
		});

		it("should throw a TypeError if entries array is empty", function () {
			const strategies = [{ name: "test", id: "test1", post() {} }];
			const client = new Client({ strategies });

			assert.rejects(
				async () => {
					await client.postTo([]);
				},
				TypeError,
				"Expected at least one entry.",
			);
		});

		it("should throw an Error if strategy ID is not found", function () {
			const strategies = [{ name: "test", id: "test1", post() {} }];
			const client = new Client({ strategies });

			assert.rejects(
				async () => {
					await client.postTo([
						{ message: "Hello", strategyId: "nonexistent" },
					]);
				},
				Error,
				'Strategy with ID "nonexistent" not found.',
			);
		});

		it("should post messages to specific strategies", async function () {
			const url1 = "https://example.com/strategy1";
			const strategies = [
				{
					name: "Strategy 1",
					id: "strategy1",
					post(message) {
						return Promise.resolve(
							`Response from strategy1: ${message}`,
						);
					},
					getUrlFromResponse() {
						return url1;
					},
				},
				{
					name: "Strategy 2",
					id: "strategy2",
					post(message) {
						return Promise.resolve(
							`Response from strategy2: ${message}`,
						);
					},
				},
				{
					name: "Strategy 3",
					id: "strategy3",
					post(message) {
						return Promise.resolve(
							`Response from strategy3: ${message}`,
						);
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [
				{ message: "Hello from 1", strategyId: "strategy1" },
				{ message: "Hello from 3", strategyId: "strategy3" },
			];

			const results = await client.postTo(entries);

			assert.strictEqual(results.length, 2);
			assert.deepStrictEqual(results, [
				new SuccessResponse(
					"Strategy 1",
					"Response from strategy1: Hello from 1",
					url1,
				),
				new SuccessResponse(
					"Strategy 3",
					"Response from strategy3: Hello from 3",
				),
			]);
		});

		it("should handle failures from specific strategies", async function () {
			const strategies = [
				{
					name: "Strategy 1",
					id: "strategy1",
					post() {
						return Promise.resolve("Success");
					},
				},
				{
					name: "Strategy 2",
					id: "strategy2",
					post() {
						return Promise.reject(new Error("Strategy 2 failed"));
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [
				{ message: "Hello 1", strategyId: "strategy1" },
				{ message: "Hello 2", strategyId: "strategy2" },
			];

			const results = await client.postTo(entries);

			assert.strictEqual(results.length, 2);
			assert.deepStrictEqual(results, [
				new SuccessResponse("Strategy 1", "Success"),
				new FailureResponse(
					"Strategy 2",
					new Error("Strategy 2 failed"),
				),
			]);
		});

		it("should pass images option to strategies", async function () {
			const receivedOptions = [];
			const testImages = [
				{ data: new Uint8Array([1, 2, 3]), alt: "test image" },
			];

			const strategies = [
				{
					name: "Strategy 1",
					id: "strategy1",
					post(message, options) {
						receivedOptions.push(options);
						return Promise.resolve("Success");
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [
				{
					message: "Hello with images",
					strategyId: "strategy1",
					images: testImages,
				},
			];

			await client.postTo(entries);

			assert.strictEqual(receivedOptions.length, 1);
			assert.deepStrictEqual(receivedOptions[0].images, testImages);
		});

		it("should pass signal option to strategies", async function () {
			const controller = new AbortController();
			const receivedOptions = [];

			const strategies = [
				{
					name: "Strategy 1",
					id: "strategy1",
					post(message, options) {
						receivedOptions.push(options);
						return Promise.resolve("Success");
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [
				{
					message: "Hello with signal",
					strategyId: "strategy1",
				},
			];

			await client.postTo(entries, { signal: controller.signal });

			assert.strictEqual(receivedOptions.length, 1);
			assert.strictEqual(receivedOptions[0].signal, controller.signal);
		});

		it("should pass both images and signal options to strategies", async function () {
			const controller = new AbortController();
			const receivedOptions = [];
			const testImages = [
				{ data: new Uint8Array([1, 2, 3]), alt: "test image" },
			];

			const strategies = [
				{
					name: "Strategy 1",
					id: "strategy1",
					post(message, options) {
						receivedOptions.push(options);
						return Promise.resolve("Success");
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [
				{
					message: "Hello with options",
					strategyId: "strategy1",
					images: testImages,
				},
			];

			await client.postTo(entries, { signal: controller.signal });

			assert.strictEqual(receivedOptions.length, 1);
			assert.deepStrictEqual(receivedOptions[0].images, testImages);
			assert.strictEqual(receivedOptions[0].signal, controller.signal);
		});

		it("should handle multiple entries for the same strategy", async function () {
			const strategies = [
				{
					name: "Strategy 1",
					id: "strategy1",
					post(message) {
						return Promise.resolve(`Response: ${message}`);
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [
				{ message: "First message", strategyId: "strategy1" },
				{ message: "Second message", strategyId: "strategy1" },
			];

			const results = await client.postTo(entries);

			assert.strictEqual(results.length, 2);
			assert.deepStrictEqual(results, [
				new SuccessResponse("Strategy 1", "Response: First message"),
				new SuccessResponse("Strategy 1", "Response: Second message"),
			]);
		});

		it("should abort when signal is triggered", async function () {
			const controller = new AbortController();
			const aborted = [];

			const strategies = [
				{
					name: "Strategy 1",
					id: "strategy1",
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
			];

			const client = new Client({ strategies });
			setTimeout(() => controller.abort(), 10);

			const entries = [
				{
					message: "Hello",
					strategyId: "strategy1",
				},
			];

			const results = await client.postTo(entries, {
				signal: controller.signal,
			});

			assert.deepStrictEqual(aborted, ["strategy1"]);
			assert.strictEqual(results.length, 1);
			assert.ok(results[0] instanceof FailureResponse);
			assert.match(results[0].reason.message, /Aborted/);
			assert.strictEqual(results[0].name, "Strategy 1");
		});
	});

	describe("postThread", function () {
		it("should throw a TypeError if entries is not an array", function () {
			const strategies = [{ name: "test", id: "test1", post() {} }];
			const client = new Client({ strategies });

			assert.rejects(
				async () => {
					await client.postThread("not an array");
				},
				TypeError,
				"Expected an array argument.",
			);
		});

		it("should throw a TypeError if entries array is empty", function () {
			const strategies = [{ name: "test", id: "test1", post() {} }];
			const client = new Client({ strategies });

			assert.rejects(
				async () => {
					await client.postThread([]);
				},
				TypeError,
				"Expected at least one entry.",
			);
		});

		it("should call postThread on strategies that have it", async function () {
			const strategies = [
				{
					name: "Strategy with Thread",
					id: "thread-strategy",
					post() {
						assert.fail("post should not be called");
					},
					postThread(entries) {
						return Promise.resolve(
							entries.map(e => `threaded: ${e.message}`),
						);
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [
				{ message: "First message" },
				{ message: "Second message" },
			];

			const results = await client.postThread(entries);

			assert.strictEqual(results.length, 1);
			assert.ok(results[0] instanceof SuccessResponse);
			assert.deepStrictEqual(results[0].response, [
				"threaded: First message",
				"threaded: Second message",
			]);
		});

		it("should call post multiple times for strategies without postThread", async function () {
			const postCalls = [];
			const strategies = [
				{
					name: "Strategy without Thread",
					id: "no-thread-strategy",
					post(message, options) {
						postCalls.push({ message, options });
						return Promise.resolve(`posted: ${message}`);
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [
				{ message: "First message" },
				{ message: "Second message" },
			];

			const results = await client.postThread(entries);

			assert.strictEqual(results.length, 1);
			assert.ok(results[0] instanceof SuccessResponse);
			assert.strictEqual(postCalls.length, 2);
			assert.strictEqual(postCalls[0].message, "First message");
			assert.strictEqual(postCalls[1].message, "Second message");
			assert.deepStrictEqual(results[0].response, [
				"posted: First message",
				"posted: Second message",
			]);
		});

		it("should handle mixed strategies with and without postThread", async function () {
			const strategies = [
				{
					name: "With Thread",
					id: "with-thread",
					postThread(entries) {
						return Promise.resolve(`thread of ${entries.length}`);
					},
				},
				{
					name: "Without Thread",
					id: "without-thread",
					post(message) {
						return Promise.resolve(`single: ${message}`);
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [
				{ message: "First message" },
				{ message: "Second message" },
			];

			const results = await client.postThread(entries);

			assert.strictEqual(results.length, 2);
			assert.ok(results[0] instanceof SuccessResponse);
			assert.ok(results[1] instanceof SuccessResponse);
			assert.strictEqual(results[0].response, "thread of 2");
			assert.deepStrictEqual(results[1].response, [
				"single: First message",
				"single: Second message",
			]);
		});

		it("should pass images to strategies", async function () {
			const receivedEntries = [];
			const testImages = [
				{ data: new Uint8Array([1, 2, 3]), alt: "test image" },
			];

			const strategies = [
				{
					name: "Strategy",
					id: "strategy1",
					postThread(entries) {
						receivedEntries.push(...entries);
						return Promise.resolve("success");
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [
				{ message: "First", images: testImages },
				{ message: "Second" },
			];

			await client.postThread(entries);

			assert.strictEqual(receivedEntries.length, 2);
			assert.deepStrictEqual(receivedEntries[0].images, testImages);
			assert.strictEqual(receivedEntries[1].images, undefined);
		});

		it("should pass signal to strategies with postThread", async function () {
			const controller = new AbortController();
			const receivedOptions = [];

			const strategies = [
				{
					name: "Strategy",
					id: "strategy1",
					postThread(entries, options) {
						receivedOptions.push(options);
						return Promise.resolve("success");
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [{ message: "Test" }];

			await client.postThread(entries, { signal: controller.signal });

			assert.strictEqual(receivedOptions.length, 1);
			assert.strictEqual(receivedOptions[0].signal, controller.signal);
		});

		it("should pass signal to strategies without postThread", async function () {
			const controller = new AbortController();
			const receivedOptions = [];

			const strategies = [
				{
					name: "Strategy",
					id: "strategy1",
					post(message, options) {
						receivedOptions.push(options);
						return Promise.resolve("success");
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [{ message: "First" }, { message: "Second" }];

			await client.postThread(entries, { signal: controller.signal });

			assert.strictEqual(receivedOptions.length, 2);
			assert.strictEqual(receivedOptions[0].signal, controller.signal);
			assert.strictEqual(receivedOptions[1].signal, controller.signal);
		});

		it("should return failure response when strategy fails", async function () {
			const strategies = [
				{
					name: "Failing Strategy",
					id: "fail",
					postThread() {
						return Promise.reject(new Error("Thread failed"));
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [{ message: "Test" }];

			const results = await client.postThread(entries);

			assert.strictEqual(results.length, 1);
			assert.ok(results[0] instanceof FailureResponse);
			assert.strictEqual(results[0].name, "Failing Strategy");
			assert.match(results[0].reason.message, /Thread failed/);
		});

		it("should handle failures in strategies without postThread", async function () {
			const strategies = [
				{
					name: "Failing Strategy",
					id: "fail",
					post(message) {
						if (message === "Second") {
							return Promise.reject(new Error("Post failed"));
						}
						return Promise.resolve("success");
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [{ message: "First" }, { message: "Second" }];

			const results = await client.postThread(entries);

			assert.strictEqual(results.length, 1);
			assert.ok(results[0] instanceof FailureResponse);
			assert.match(results[0].reason.message, /Post failed/);
		});

		it("should call getUrlFromResponse when available", async function () {
			const url1 = "https://example.com/thread";

			const strategies = [
				{
					name: "Strategy",
					id: "strategy1",
					postThread() {
						return Promise.resolve({ id: "123" });
					},
					getUrlFromResponse(response) {
						return `${url1}/${response.id}`;
					},
				},
			];

			const client = new Client({ strategies });
			const entries = [{ message: "Test" }];

			const results = await client.postThread(entries);

			assert.strictEqual(results.length, 1);
			assert.ok(results[0] instanceof SuccessResponse);
			assert.strictEqual(
				results[0].url,
				"https://example.com/thread/123",
			);
		});
	});
});
