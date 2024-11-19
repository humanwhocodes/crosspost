/**
 * @fileoverview Tests for the Client class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { strict as assert } from "node:assert";
import { Client } from "../src/client.js";

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
						return Promise.resolve("test2");
					},
				},
			];

			const client = new Client({ strategies });
			const response = await client.post("Hello, world!");

			assert.deepStrictEqual(response, {
				test1: "test1",
				test2: "test2",
			});
		});

		it("should throw an error when one strategy fails", async function () {
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
				},
			];

			const client = new Client({ strategies });

			await assert.rejects(client.post("Hello, world!"), {
				name: "AggregateError",
				message: "Failed to post to strategies: test2",
			});
		});

		it("should throw an error when multiple strategies fail", async function () {
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

			await assert.rejects(client.post("Hello, world!"), {
				name: "AggregateError",
				message: "Failed to post to strategies: test1, test2",
			});
		});
	});
});
