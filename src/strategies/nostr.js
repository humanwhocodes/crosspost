/**
 * @fileoverview Nostr strategy for posting messages.
 * @author Arda Kilicdagi
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { schnorr } from "@noble/curves/secp256k1";
import { WebSocket } from "ws";
import { createHash } from "node:crypto";
import { nsecToHex } from "../util/nostr.js";
import { Buffer } from "node:buffer";
import { setTimeout, clearTimeout } from "node:timers";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} NostrOptions
 * @property {string} privateKey The Nostr private key in `nsec` format.
 * @property {string[]} [relays] An array of relay URLs to use.
 */

/**
 * @typedef {Object} NostrPostResponse
 * @property {string} id The event ID as a hex string.
 * @property {string} url The URL to view the post (njump.me link).
 * @property {string} text The original message text.
 */

// #region Helper functions
/**
 * Creates a Nostr event ID.
 * @param {import("../types.js").NostrEvent} event The event to create an ID for.
 * @returns {string} The event ID as a hex string.
 */
function createEventId(event) {
	const serializedEvent = JSON.stringify([
		0,
		event.pubkey,
		event.created_at,
		event.kind,
		event.tags,
		event.content,
	]);
	const hash = createHash("sha256");
	hash.update(serializedEvent);
	return hash.digest("hex");
}

/**
 * Signs a Nostr event.
 * @param {string} privateKey The private key to sign with.
 * @param {string} eventId The event ID to sign.
 * @returns {Promise<string>} The signature as a hex string.
 */
async function signEvent(privateKey, eventId) {
	// The eventId is a hex string, but signAsync expects a 32-byte Uint8Array.
	const eventIdBytes = Buffer.from(eventId, "hex");
	// The private key is a hex string, but signAsync expects a 32-byte Uint8Array.
	const privateKeyBytes = Buffer.from(privateKey, "hex");
	const signature = await schnorr.sign(eventIdBytes, privateKeyBytes);
	return Buffer.from(signature).toString("hex");
}

/**
 * Creates a Nostr event.
 * @param {string} message The message to post.
 * @param {string} publicKey The public key of the author.
 * @returns {Partial<import("../types.js").NostrEvent>} The created event.
 */
function createEvent(message, publicKey) {
	return {
		pubkey: publicKey,
		created_at: Math.floor(Date.now() / 1000),
		kind: 1,
		tags: [],
		content: message,
	};
}

// #endregion

/**
 * A strategy for posting to the Nostr network.
 * @typedef {import("../types.js").Strategy} Strategy
 * @implements {Strategy}
 */
export class NostrStrategy {
	/**
	 * The display name of the strategy.
	 * @type {string}
	 */
	name = "Nostr";

	/**
	 * The unique ID of the strategy.
	 * @type {string}
	 */
	id = "nostr";

	/**
	 * The maximum message length for Nostr.
	 * According to NIP-01, there is no limit, but this is a reasonable default.
	 * @type {number}
	 */
	MAX_MESSAGE_LENGTH = 1024;

	/**
	 * Calculates the message length.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The length of the message.
	 */
	calculateMessageLength(message) {
		return message.length;
	}

	/**
	 * The relays to publish to.
	 * @type {string[]}
	 */
	#relays;

	/**
	 * The private key as a hex string.
	 * @type {string}
	 */
	#privateKeyHex;

	/**
	 * The public key as a hex string.
	 * @type {string}
	 */
	#publicKeyHex;

	/**
	 * Creates a new instance of the NostrStrategy.
	 * @param {NostrOptions} options The options for the strategy.
	 */
	constructor({
		privateKey,
		relays = [
			"wss://relay.damus.io",
			"wss://relay.nostr.band",
			"wss://nos.lol",
		],
	}) {
		if (!privateKey) {
			throw new Error("Nostr private key is required.");
		}

		this.#privateKeyHex = nsecToHex(privateKey);

		// Nostr uses the 32-byte X-only public key.
		const privateKeyBytes = Buffer.from(this.#privateKeyHex, "hex");
		const publicKeyBytes = schnorr.getPublicKey(privateKeyBytes);
		this.#publicKeyHex = Buffer.from(publicKeyBytes).toString("hex");

		this.#relays = relays;
	}

	/**
	 * Posts a message to the Nostr network.
	 * @param {string} message The message to post.
	 * @param {import("../types.js").PostOptions} [postOptions] Options for posting.
	 * @returns {Promise<NostrPostResponse>} A promise that resolves with the result of the post.
	 */
	async post(message, postOptions) {
		if (typeof message !== "string" || message.length === 0) {
			throw new TypeError("Message must be a non-empty string.");
		}

		if (message.length > this.MAX_MESSAGE_LENGTH) {
			throw new Error(
				`Message exceeds maximum length of ${this.MAX_MESSAGE_LENGTH} characters.`,
			);
		}

		const event = createEvent(
			message,
			this.#publicKeyHex,
		);
		event.id = createEventId(
			/** @type {import("../types.js").NostrEvent} */ (event),
		);
		event.sig = await signEvent(this.#privateKeyHex, event.id);

		const results = await Promise.allSettled(
			this.#relays.map(relayUrl =>
				this.#publishToRelay(
					relayUrl,
					/** @type {import("../types.js").NostrEvent} */ (event),
					postOptions?.signal,
				),
			),
		);

		const successfulPosts = results.filter(
			result => result.status === "fulfilled" && result.value,
		);

		if (successfulPosts.length === 0) {
			throw new Error("Failed to publish to any relay");
		}

		return {
			id: event.id,
			url: `https://njump.me/${event.id}`,
			text: message,
		};
	}

	/**
	 * Publishes an event to a single relay.
	 * @param {string} relayUrl The URL of the relay to publish to.
	 * @param {import("../types.js").NostrEvent} event The event to publish.
	 * @param {AbortSignal} [signal] An optional abort signal.
	 * @returns {Promise<boolean>} A promise that resolves to true if the event was published successfully.
	 */
	async #publishToRelay(relayUrl, event, signal) {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(relayUrl);
			let resolved = false;

			const cleanup = () => {
				if (ws.readyState === WebSocket.OPEN) {
					ws.close();
				}
			};

			const timeoutId = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					cleanup();
					reject(new Error("Relay connection timeout"));
				}
			}, 10000); // 10 second timeout

			// Handle abort signal
			const abortHandler = () => {
				if (!resolved) {
					resolved = true;
					cleanup();
					clearTimeout(timeoutId);
					reject(new Error("Request aborted"));
				}
			};

			if (signal) {
				if (signal.aborted) {
					clearTimeout(timeoutId);
					reject(new Error("Request aborted"));
					return;
				}
				signal.addEventListener("abort", abortHandler);
			}

			ws.on("open", () => {
				// Send the event
				ws.send(JSON.stringify(["EVENT", event]));
			});

			ws.on("message", (data) => {
				if (!resolved) {
					try {
						const message = JSON.parse(data.toString());
						if (Array.isArray(message) && message[0] === "OK" && message[1] === event.id) {
							resolved = true;
							cleanup();
							clearTimeout(timeoutId);
							if (signal) {
								signal.removeEventListener("abort", abortHandler);
							}
							// The third element indicates success (true) or failure (false)
							resolve(message[2]);
						}
					} catch {
						// Ignore parse errors for other messages
					}
				}
			});

			ws.on("error", (error) => {
				if (!resolved) {
					resolved = true;
					cleanup();
					clearTimeout(timeoutId);
					if (signal) {
						signal.removeEventListener("abort", abortHandler);
					}
					reject(error);
				}
			});

			ws.on("close", () => {
				if (!resolved) {
					resolved = true;
					clearTimeout(timeoutId);
					if (signal) {
						signal.removeEventListener("abort", abortHandler);
					}
					resolve(false); // Connection closed without confirmation
				}
			});
		});
	}
}
