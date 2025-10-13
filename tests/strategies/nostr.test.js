/**
 * @fileoverview Tests for the NostrStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { NostrStrategy } from "../../src/strategies/nostr.js";
import assert from "node:assert";
import { ws } from "msw";
import { setupServer } from "msw/node";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const validPrivateKeyHex =
	"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const validPrivateKeyBech32 =
	"nsec1qy352euf40x77qfrg4ncn27dauqjx3t83x4ummcpydzk0zdtehhs80zqrl";
const validRelays = ["wss://relay.example.com", "wss://relay2.example.com"];
const message = "Hello Nostr world!";

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("NostrStrategy", () => {
	/** @type {ReturnType<typeof setupServer>} */
	let server;

	before(() => {
		server = setupServer();
		server.listen({ onUnhandledRequest: "bypass" });
	});

	afterEach(() => {
		server.resetHandlers();
	});

	after(() => {
		server.close();
	});

	describe("constructor", () => {
		it("should throw an error when options are missing", () => {
			assert.throws(() => {
				new NostrStrategy();
			}, /Missing options for NostrStrategy/);
		});

		it("should throw an error when private key is missing", () => {
			assert.throws(() => {
				new NostrStrategy({ relays: validRelays });
			}, /Missing private key/);
		});

		it("should throw an error when relays are missing", () => {
			assert.throws(() => {
				new NostrStrategy({ privateKey: validPrivateKeyHex });
			}, /Missing or invalid relays array/);
		});

		it("should throw an error when relays is not an array", () => {
			assert.throws(() => {
				new NostrStrategy({
					privateKey: validPrivateKeyHex,
					relays: "not-an-array",
				});
			}, /Missing or invalid relays array/);
		});

		it("should throw an error when relays array is empty", () => {
			assert.throws(() => {
				new NostrStrategy({
					privateKey: validPrivateKeyHex,
					relays: [],
				});
			}, /At least one relay URL is required/);
		});

		it("should throw an error when relay URL is not a WebSocket URL", () => {
			assert.throws(() => {
				new NostrStrategy({
					privateKey: validPrivateKeyHex,
					relays: ["http://invalid.com"],
				});
			}, /All relay URLs must be valid WebSocket URLs/);
		});

		it("should throw an error when private key is in invalid format", () => {
			assert.throws(() => {
				new NostrStrategy({
					privateKey: "invalid-key",
					relays: validRelays,
				});
			}, /Private key must be 64-character hex string or bech32 format/);
		});

		it("should create an instance with hex private key", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});
			assert.strictEqual(strategy.id, "nostr");
			assert.strictEqual(strategy.name, "Nostr");
		});

		it("should create an instance with bech32 private key", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyBech32,
				relays: validRelays,
			});
			assert.strictEqual(strategy.id, "nostr");
			assert.strictEqual(strategy.name, "Nostr");
		});

		it("should create an instance with wss:// relay URLs", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: ["wss://relay.example.com"],
			});
			assert(strategy instanceof NostrStrategy);
		});

		it("should create an instance with ws:// relay URLs", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: ["ws://relay.example.com"],
			});
			assert(strategy instanceof NostrStrategy);
		});
	});

	describe("MAX_MESSAGE_LENGTH", () => {
		it("should have a MAX_MESSAGE_LENGTH property", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});
			assert.strictEqual(strategy.MAX_MESSAGE_LENGTH, 280);
		});
	});

	describe("calculateMessageLength", () => {
		it("should calculate length of plain text correctly", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});
			assert.strictEqual(strategy.calculateMessageLength("Hello"), 5);
		});

		it("should count emojis correctly", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});
			assert.strictEqual(strategy.calculateMessageLength("👋🌍"), 2);
		});

		it("should count URLs at their actual length", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});
			const messageWithUrl =
				"Check this out: https://example.com/very/long/path";
			assert.strictEqual(
				strategy.calculateMessageLength(messageWithUrl),
				messageWithUrl.length,
			);
		});
	});

	describe("post", () => {
		it("should throw a TypeError when message is missing", async () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});
			await assert.rejects(
				strategy.post(),
				TypeError,
				"Missing message to post.",
			);
		});

		it("should throw an error when images are provided", async () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});

			const imageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
			await assert.rejects(
				strategy.post(message, { images: [{ data: imageData }] }),
				Error,
				"Images are not supported in Nostr text notes.",
			);
		});

		it("should successfully post a message to one relay", async () => {
			const relayUrl = validRelays[0];
			const relay = ws.link(relayUrl);

			server.use(
				relay.addEventListener("connection", ({ client }) => {
					client.addEventListener("message", event => {
						const payload = JSON.parse(event.data);
						assert(Array.isArray(payload));
						assert.strictEqual(payload[0], "EVENT");
						const eventData = payload[1];
						assert.strictEqual(eventData.content, message);

						client.send(JSON.stringify(["OK", eventData.id, true]));
					});
				}),
			);

			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: [relayUrl],
			});

			const response = await strategy.post(message);
			assert.strictEqual(response.success, true);
			assert(response.id);
			assert.deepStrictEqual(response.relays, [relayUrl]);
			assert.deepStrictEqual(response.errors, []);
		});

		it("should successfully post a message to multiple relays", async () => {
			const relayUrl1 = "wss://relay.test-1.example.com";
			const relayUrl2 = "wss://relay.test-2.example.com";
			const relay1 = ws.link(relayUrl1);
			const relay2 = ws.link(relayUrl2);

			server.use(
				relay1.addEventListener("connection", ({ client }) => {
					client.addEventListener("message", event => {
						const payload = JSON.parse(event.data);
						client.send(
							JSON.stringify(["OK", payload[1].id, true]),
						);
					});
				}),
				relay2.addEventListener("connection", ({ client }) => {
					client.addEventListener("message", event => {
						const payload = JSON.parse(event.data);
						client.send(
							JSON.stringify(["OK", payload[1].id, true]),
						);
					});
				}),
			);

			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: [relayUrl1, relayUrl2],
			});

			const response = await strategy.post(message);
			assert.strictEqual(response.success, true);
			assert(response.id);
			assert.deepStrictEqual(
				response.relays.slice().sort(),
				[relayUrl1, relayUrl2].sort(),
			);
			assert.deepStrictEqual(response.errors, []);
		});

		it("should handle partial relay failures", async () => {
			const relayUrl1 = "wss://relay.partial-success.example.com";
			const relayUrl2 = "wss://relay.partial-failure.example.com";
			const relay1 = ws.link(relayUrl1);
			const relay2 = ws.link(relayUrl2);

			server.use(
				relay1.addEventListener("connection", ({ client }) => {
					client.addEventListener("message", event => {
						const payload = JSON.parse(event.data);
						client.send(
							JSON.stringify(["OK", payload[1].id, true]),
						);
					});
				}),
				relay2.addEventListener("connection", ({ client }) => {
					client.addEventListener("message", event => {
						const payload = JSON.parse(event.data);
						client.send(
							JSON.stringify([
								"OK",
								payload[1].id,
								false,
								"rate limited",
							]),
						);
					});
				}),
			);

			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: [relayUrl1, relayUrl2],
			});

			const response = await strategy.post(message);
			assert.strictEqual(response.success, true);
			assert(response.id);
			assert.deepStrictEqual(response.relays, [relayUrl1]);
			assert.strictEqual(response.errors.length, 1);
			assert.match(
				response.errors[0],
				new RegExp(`${relayUrl2}: rate limited`),
			);
		});

		it("should throw an error when all relays fail", async () => {
			const relayUrl1 = "wss://relay.fail-1.example.com";
			const relayUrl2 = "wss://relay.fail-2.example.com";
			const relay1 = ws.link(relayUrl1);
			const relay2 = ws.link(relayUrl2);

			server.use(
				relay1.addEventListener("connection", ({ client }) => {
					client.addEventListener("message", event => {
						const payload = JSON.parse(event.data);
						client.send(
							JSON.stringify([
								"OK",
								payload[1].id,
								false,
								"blocked",
							]),
						);
					});
				}),
				relay2.addEventListener("connection", ({ client }) => {
					client.addEventListener("message", event => {
						const payload = JSON.parse(event.data);
						client.send(
							JSON.stringify([
								"OK",
								payload[1].id,
								false,
								"timeout",
							]),
						);
					});
				}),
			);

			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: [relayUrl1, relayUrl2],
			});

			await assert.rejects(strategy.post(message), error => {
				assert(error instanceof Error);
				assert.match(error.message, /Failed to publish to any relays/);
				assert.match(
					error.message,
					new RegExp(`${relayUrl1}: blocked`),
				);
				assert.match(
					error.message,
					new RegExp(`${relayUrl2}: timeout`),
				);
				return true;
			});
		});

		it("should abort when signal is triggered", async () => {
			const controller = new AbortController();
			controller.abort();

			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});

			await assert.rejects(
				strategy.post(message, { signal: controller.signal }),
				error => {
					assert(error instanceof Error);
					assert.match(
						error.message,
						/Failed to publish to any relays/,
					);
					assert.match(error.message, /Request was aborted/);
					return true;
				},
			);
		});

		it("should handle connection closures", async () => {
			const relayUrl = "wss://relay.closed-connection.example.com";
			const relay = ws.link(relayUrl);

			server.use(
				relay.addEventListener("connection", ({ client }) => {
					client.close();
				}),
			);

			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: [relayUrl],
			});

			await assert.rejects(strategy.post(message), error => {
				assert(error instanceof Error);
				assert.match(error.message, /Failed to publish to any relays/);
				assert.match(error.message, /Connection closed unexpectedly/);
				return true;
			});
		});
	});

	describe("getUrlFromResponse", () => {
		it("should generate a note URL from response", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});

			const response = {
				id: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
				success: true,
				relays: ["wss://relay.example.com"],
				errors: [],
			};

			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(
				url,
				"nostr:note140x3yd9te5frf27dzg62hngjxj4u6y3540x3yd9te5frf27dzg6qjxxkaj",
			);
		});

		it("should throw an error when response has no successful relays", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});

			assert.throws(
				() => {
					strategy.getUrlFromResponse({ relays: [] });
				},
				Error,
				"No successful relays in response",
			);
		});

		it("should throw an error when response is null", () => {
			const strategy = new NostrStrategy({
				privateKey: validPrivateKeyHex,
				relays: validRelays,
			});

			assert.throws(
				() => {
					strategy.getUrlFromResponse(null);
				},
				Error,
				"No successful relays in response",
			);
		});
	});
});
