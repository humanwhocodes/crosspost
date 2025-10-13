/**
 * @fileoverview Nostr strategy for posting messages.
 * @author Nicholas C. Zakas
 */

/* global Buffer, WebSocket, setTimeout */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { schnorr, hashes } from "@noble/secp256k1";
import { bech32 } from "bech32";
import { createHash, createHmac } from "node:crypto";
import { validatePostOptions } from "../util/options.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("../types.js").PostOptions} PostOptions */

/**
 * @typedef {Object} NostrOptions
 * @property {string} privateKey The private key for signing events (hex or bech32).
 * @property {string[]} relays Array of relay URLs to post to.
 */

/**
 * @typedef {Object} NostrEvent
 * @property {string} id The event ID (32-byte hex).
 * @property {string} pubkey The public key of the event creator (32-byte hex).
 * @property {number} created_at Unix timestamp in seconds.
 * @property {number} kind The event kind (1 for short text note).
 * @property {string[][]} tags Array of tags.
 * @property {string} content The event content.
 * @property {string} sig The signature (64-byte hex).
 */

/**
 * @typedef {Object} NostrEventResponse
 * @property {string} id The event ID.
 * @property {boolean} success Whether the event was published successfully.
 * @property {string[]} relays Array of relays that accepted the event.
 * @property {string[]} errors Array of relay errors.
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/*
 * Configure noble/secp256k1 to use Node.js crypto for hashing.
 * This is necessary because the default Web Crypto API in Node.js
 * does not support synchronous hashing, which noble/secp256k1 requires.
 */
hashes.sha256 = /** @type {(message: Uint8Array) => Uint8Array} */ (
	msg => createHash("sha256").update(msg).digest()
);
hashes.hmacSha256 =
	/** @type {(key: Uint8Array, ...messages: Uint8Array[]) => Uint8Array} */ (
		(key, ...msgs) => {
			const hmac = createHmac("sha256", key);

			for (const msg of msgs) {
				hmac.update(msg);
			}

			return hmac.digest();
		}
	);

/**
 * Converts a private key from bech32 format to hex.
 * @param {string} privateKey The private key in hex or bech32 format.
 * @returns {string} The private key in hex format.
 * @throws {Error} If the key format is invalid.
 */
function normalizePrivateKey(privateKey) {
	// Check if it's already hex (64 characters)
	if (/^[0-9a-f]{64}$/i.test(privateKey)) {
		return privateKey.toLowerCase();
	}

	// Try to decode bech32
	if (privateKey.startsWith("nsec1")) {
		try {
			const { words } = bech32.decode(privateKey);
			const keyBytes = bech32.fromWords(words);
			return Buffer.from(keyBytes).toString("hex");
		} catch (error) {
			throw new Error("Invalid bech32 private key format", {
				cause: error,
			});
		}
	}

	throw new Error(
		"Private key must be 64-character hex string or bech32 format starting with nsec1",
	);
}

/**
 * Creates a Nostr event.
 * @param {string} privateKeyHex The private key in hex format.
 * @param {string} content The content of the event.
 * @returns {NostrEvent} The signed Nostr event.
 */
function createNostrEvent(privateKeyHex, content) {
	const privateKeyBytes = new Uint8Array(Buffer.from(privateKeyHex, "hex"));

	// Get the Schnorr public key (x-only, 32 bytes)
	const publicKeyBytes = schnorr.getPublicKey(privateKeyBytes);
	const pubkey = Buffer.from(publicKeyBytes).toString("hex");

	const event = {
		pubkey,
		created_at: Math.floor(Date.now() / 1000),
		kind: 1,
		tags: [],
		content,
	};

	// Calculate event ID (hash of serialized event data)
	const eventData = JSON.stringify([
		0,
		event.pubkey,
		event.created_at,
		event.kind,
		event.tags,
		event.content,
	]);

	const eventHash = createHash("sha256").update(eventData, "utf8").digest();
	const id = eventHash.toString("hex");

	// Sign the event hash using Schnorr signatures
	const signature = schnorr.sign(eventHash, privateKeyBytes);
	const sig = Buffer.from(signature).toString("hex");

	return {
		id,
		...event,
		sig,
	};
}

/**
 * Publishes an event to a Nostr relay via WebSocket.
 * @param {string} relayUrl The relay URL.
 * @param {NostrEvent} event The event to publish.
 * @param {AbortSignal} [signal] Optional abort signal.
 * @returns {Promise<{success: boolean, error?: string}>} The result of publishing.
 */
function publishToRelay(relayUrl, event, signal) {
	return new Promise(resolve => {
		/** @type {WebSocket | undefined} */
		let ws;
		let resolved = false;

		const cleanup = () => {
			if (ws) {
				ws.close();
			}
		};

		/** @param {{success: boolean, error?: string}} result */
		const resolveOnce = result => {
			if (!resolved) {
				resolved = true;
				cleanup();
				resolve(result);
			}
		};

		// Handle abort signal
		if (signal?.aborted) {
			return resolveOnce({
				success: false,
				error: "Request was aborted",
			});
		}

		const abortHandler = () => {
			resolveOnce({ success: false, error: "Request was aborted" });
		};

		signal?.addEventListener("abort", abortHandler);

		try {
			ws = new WebSocket(relayUrl);

			ws.addEventListener("open", () => {
				const message = JSON.stringify(["EVENT", event]);
				if (ws) {
					ws.send(message);
				}
			});

			ws.addEventListener("message", msgEvent => {
				try {
					const data = JSON.parse(msgEvent.data.toString());
					if (
						Array.isArray(data) &&
						data[0] === "OK" &&
						data[1] === event.id
					) {
						const success = data[2] === true;
						const error = success ? undefined : data[3];
						resolveOnce({ success, error });
					}
				} catch (error) {
					const errorMessage =
						error instanceof Error
							? error.message
							: "Unknown error";
					resolveOnce({
						success: false,
						error: "Invalid response from relay: " + errorMessage,
					});
				}
			});

			ws.addEventListener("error", () => {
				resolveOnce({
					success: false,
					error: "WebSocket connection failed",
				});
			});

			ws.addEventListener("close", () => {
				if (!resolved) {
					resolveOnce({
						success: false,
						error: "Connection closed unexpectedly",
					});
				}
			});

			// Timeout after 10 seconds
			setTimeout(() => {
				resolveOnce({ success: false, error: "Request timed out" });
			}, 10000);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			resolveOnce({ success: false, error: errorMessage });
		} finally {
			signal?.removeEventListener("abort", abortHandler);
		}
	});
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting messages to Nostr.
 */
export class NostrStrategy {
	/**
	 * The ID of the strategy.
	 * @type {string}
	 * @readonly
	 */
	id = "nostr";

	/**
	 * The display name of the strategy.
	 * @type {string}
	 * @readonly
	 */
	name = "Nostr";

	/**
	 * Maximum length of a Nostr message in characters.
	 * Most Nostr clients use similar limits to Twitter.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 280;

	/**
	 * Options for this instance.
	 * @type {NostrOptions & {privateKeyHex: string}}
	 */
	#options;

	/**
	 * Creates a new instance.
	 * @param {NostrOptions} options Options for the instance.
	 * @throws {Error} When options are missing or invalid.
	 */
	constructor(options) {
		if (!options) {
			throw new Error("Missing options for NostrStrategy.");
		}

		if (!options.privateKey) {
			throw new Error("Missing private key.");
		}

		if (!options.relays || !Array.isArray(options.relays)) {
			throw new Error("Missing or invalid relays array.");
		}

		if (options.relays.length === 0) {
			throw new Error("At least one relay URL is required.");
		}

		// Validate relay URLs
		for (const relay of options.relays) {
			if (typeof relay !== "string" || !relay.startsWith("ws")) {
				throw new Error(
					"All relay URLs must be valid WebSocket URLs (ws:// or wss://).",
				);
			}
		}

		// Normalize and validate private key
		const privateKeyHex = normalizePrivateKey(options.privateKey);

		this.#options = {
			...options,
			privateKeyHex,
		};
	}

	/**
	 * Calculates the length of a message according to Nostr's counting rules.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The length of the message.
	 */
	calculateMessageLength(message) {
		// Simple character count for Nostr
		return [...message].length;
	}

	/**
	 * Posts a message to Nostr relays.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<NostrEventResponse>} A promise that resolves with the event response.
	 * @throws {Error} When the message fails to post to all relays.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		// Nostr doesn't support images in kind 1 events
		if (postOptions?.images?.length) {
			throw new Error("Images are not supported in Nostr text notes.");
		}

		// Create the Nostr event
		const event = createNostrEvent(this.#options.privateKeyHex, message);

		// Publish to all relays
		const results = await Promise.allSettled(
			this.#options.relays.map(relay =>
				publishToRelay(relay, event, postOptions?.signal),
			),
		);

		/** @type {string[]} */
		const successfulRelays = [];
		/** @type {string[]} */
		const errors = [];

		results.forEach((result, index) => {
			const relay = this.#options.relays[index];
			if (result.status === "fulfilled" && result.value.success) {
				successfulRelays.push(relay);
			} else {
				const error =
					result.status === "rejected"
						? result.reason.message
						: result.value.error;
				errors.push(`${relay}: ${error}`);
			}
		});

		// If no relays succeeded, throw an error
		if (successfulRelays.length === 0) {
			throw new Error(
				`Failed to publish to any relays: ${errors.join(", ")}`,
			);
		}

		return {
			id: event.id,
			success: true,
			relays: successfulRelays,
			errors,
		};
	}

	/**
	 * Gets a URL from the response (Nostr doesn't have a standard URL format).
	 * @param {NostrEventResponse} response The response from posting.
	 * @returns {string} A note URL (using the first successful relay).
	 */
	getUrlFromResponse(response) {
		if (!response || !response.relays || response.relays.length === 0) {
			throw new Error("No successful relays in response");
		}

		// Use nip19 note format with event ID
		const noteId = `${bech32.encode("note", bech32.toWords(Buffer.from(response.id, "hex")))}`;

		// Return a generic note URL - in practice, clients would construct their own URLs
		return `nostr:${noteId}`;
	}
}
