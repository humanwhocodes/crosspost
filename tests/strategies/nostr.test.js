/**
 * @fileoverview Tests for the NostrStrategy class.
 * @author Arda Kilicdagi
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { NostrStrategy } from "../../src/strategies/nostr.js";
import assert from "node:assert";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import * as nip19 from "nostr-tools/nip19";
import { bytesToHex } from "@noble/hashes/utils";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const mockRelays = ["wss://relay.example.com", "wss://relay2.example.com"];
const testPrivateKey = generateSecretKey();
const testPrivateKeyHex = bytesToHex(testPrivateKey);
const testPrivateKeyNsec = nip19.nsecEncode(testPrivateKey);
const testPublicKey = getPublicKey(testPrivateKey);

const pngImageData = new Uint8Array([
	// PNG signature
	0x89,
	0x50,
	0x4e,
	0x47,
	0x0d,
	0x0a,
	0x1a,
	0x0a,
	// IHDR chunk (minimal)
	0x00,
	0x00,
	0x00,
	0x0d,
	0x49,
	0x48,
	0x44,
	0x52,
	0x00,
	0x00,
	0x00,
	0x01,
	0x00,
	0x00,
	0x00,
	0x01,
	0x08,
	0x06,
	0x00,
	0x00,
	0x00,
	0x1f,
	0x15,
	0xc4,
	0x89,
	// IEND chunk
	0x00,
	0x00,
	0x00,
	0x00,
	0x49,
	0x45,
	0x4e,
	0x44,
	0xae,
	0x42,
	0x60,
	0x82,
]);

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("NostrStrategy", () => {
	describe("constructor", () => {
		it("should throw an error when the private key is missing", () => {
			assert.throws(() => {
				new NostrStrategy({
					relays: mockRelays,
				});
			}, /Missing Nostr private key/);
		});

		it("should throw an error when relays are missing", () => {
			assert.throws(() => {
				new NostrStrategy({
					privateKey: testPrivateKeyHex,
				});
			}, /Missing or empty Nostr relays array/);
		});

		it("should throw an error when relays is not an array", () => {
			assert.throws(() => {
				new NostrStrategy({
					privateKey: testPrivateKeyHex,
					relays: "wss://relay.example.com",
				});
			}, /Missing or empty Nostr relays array/);
		});

		it("should throw an error when relays array is empty", () => {
			assert.throws(() => {
				new NostrStrategy({
					privateKey: testPrivateKeyHex,
					relays: [],
				});
			}, /Missing or empty Nostr relays array/);
		});

		it("should create an instance with hex private key", () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyHex,
				relays: mockRelays,
			});

			assert.strictEqual(strategy.id, "nostr");
			assert.strictEqual(strategy.name, "Nostr");
			assert.strictEqual(strategy.MAX_MESSAGE_LENGTH, 5000);
		});

		it("should create an instance with nsec private key", () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyNsec,
				relays: mockRelays,
			});

			assert.strictEqual(strategy.id, "nostr");
			assert.strictEqual(strategy.name, "Nostr");
		});

		it("should throw an error with invalid nsec private key", () => {
			assert.throws(() => {
				new NostrStrategy({
					privateKey: "nsec1invalid",
					relays: mockRelays,
				});
			}, /Invalid nsec private key/);
		});

		it("should throw an error with invalid hex private key", () => {
			assert.throws(() => {
				new NostrStrategy({
					privateKey: "invalidhex",
					relays: mockRelays,
				});
			}, /Invalid hex private key/);
		});
	});

	describe("calculateMessageLength", () => {
		it("should return the correct length for ASCII messages", () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyHex,
				relays: mockRelays,
			});

			assert.strictEqual(strategy.calculateMessageLength("Hello"), 5);
			assert.strictEqual(strategy.calculateMessageLength(""), 0);
		});

		it("should return the correct length for Unicode messages", () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyHex,
				relays: mockRelays,
			});

			assert.strictEqual(strategy.calculateMessageLength("Hello 👋"), 7);
			assert.strictEqual(strategy.calculateMessageLength("café"), 4);
		});
	});

	describe("post", () => {
		it("should throw an error when message is missing", async () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyHex,
				relays: mockRelays,
			});

			await assert.rejects(
				strategy.post(),
				{
					name: "TypeError",
					message: "Missing message to post.",
				}
			);
		});

		it("should throw an error when message is empty", async () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyHex,
				relays: mockRelays,
			});

			await assert.rejects(
				strategy.post(""),
				{
					name: "TypeError",
					message: "Missing message to post.",
				}
			);
		});

		it("should throw an error when images are provided", async () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyHex,
				relays: mockRelays,
			});

			const images = [{ data: pngImageData, alt: "Test image" }];
			
			await assert.rejects(
				strategy.post("Hello Nostr!", { images }),
				{
					name: "Error",
					message: "Direct image uploads are not supported by Nostr. Please upload images to external services and include URLs in the message.",
				}
			);
		});

		it("should throw a TypeError if postOptions is not an object", async () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyHex,
				relays: mockRelays,
			});

			const message = "Hello Nostr!";

			await assert.rejects(
				strategy.post(message, "invalid"),
				{
					name: "TypeError",
					message: "Expected an object.",
				}
			);
		});

		it("should handle AbortSignal gracefully", async () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyHex,
				relays: mockRelays,
			});

			const message = "Hello Nostr!";
			const controller = new AbortController();
			const signal = controller.signal;

			// Should not immediately throw with valid signal
			// (though it will likely fail when trying to connect to mock relays)
			try {
				await strategy.post(message, { signal });
			} catch (error) {
				// Expected to fail since we're using mock relays
				assert(error.message.includes("Failed to post to Nostr"));
			}
		});
	});

	describe("getUrlFromResponse", () => {
		it("should return a nostr URI for the event", () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyHex,
				relays: mockRelays,
			});

			const mockResponse = {
				event: {
					id: "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234",
					pubkey: testPublicKey,
					created_at: 1234567890,
					kind: 1,
					tags: [],
					content: "Hello Nostr!",
					sig: "mock_signature",
				},
				publishedTo: ["wss://relay.example.com"],
			};

			const url = strategy.getUrlFromResponse(mockResponse);
			assert.strictEqual(url, `nostr:${mockResponse.event.id}`);
		});
	});

	describe("close", () => {
		it("should not throw when closing", () => {
			const strategy = new NostrStrategy({
				privateKey: testPrivateKeyHex,
				relays: mockRelays,
			});

			// Should not throw
			assert.doesNotThrow(() => {
				strategy.close();
			});
		});
	});
});
