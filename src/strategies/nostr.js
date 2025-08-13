/**
 * @fileoverview Nostr strategy for posting notes.
 * @author Arda Kilicdagi
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { finalizeEvent } from "nostr-tools/pure";
import { SimplePool, useWebSocketImplementation } from "nostr-tools/pool";
import * as nip19 from "nostr-tools/nip19";
import { hexToBytes } from "@noble/hashes/utils";
import { validatePostOptions } from "../util/options.js";
import WebSocket from "ws";

// Set up WebSocket implementation for Node.js
useWebSocketImplementation(WebSocket);

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} NostrOptions
 * @property {string} privateKey The private key for the Nostr account (nsec format or hex).
 * @property {string[]} relays Array of relay URLs to publish to.
 */

/**
 * @typedef {Object} NostrEvent
 * @property {string} id The event ID.
 * @property {string} pubkey The public key of the author.
 * @property {number} created_at Unix timestamp when the event was created.
 * @property {number} kind The kind of event (1 for text note).
 * @property {string[][]} tags Array of tags.
 * @property {string} content The content of the note.
 * @property {string} sig The signature of the event.
 */

/**
 * @typedef {Object} NostrPostResponse
 * @property {NostrEvent} event The published event.
 * @property {string[]} publishedTo Array of relay URLs that successfully published the event.
 */

/** @typedef {import("../types.js").PostOptions} PostOptions */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A strategy for posting notes to Nostr.
 */
export class NostrStrategy {
	/**
	 * Maximum length of a Nostr note in characters.
	 * While technically Nostr doesn't have a hard limit, most clients
	 * expect reasonable note lengths.
	 * @type {number}
	 * @const
	 */
	MAX_MESSAGE_LENGTH = 5000;

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
	 * The private key for this instance.
	 * @type {Uint8Array}
	 */
	#privateKey;

	/**
	 * The relay URLs for this instance.
	 * @type {string[]}
	 */
	#relays;

	/**
	 * The SimplePool instance for managing relay connections.
	 * @type {SimplePool}
	 */
	#pool;

	/**
	 * Creates a new instance.
	 * @param {NostrOptions} options Options for the instance.
	 * @throws {TypeError} When options are missing or invalid.
	 */
	constructor(options) {
		const { privateKey, relays } = options;

		if (!privateKey) {
			throw new TypeError("Missing Nostr private key.");
		}

		if (!relays || !Array.isArray(relays) || relays.length === 0) {
			throw new TypeError("Missing or empty Nostr relays array.");
		}

		// Parse private key - support both nsec format and hex
		let secretKey;
		if (privateKey.startsWith("nsec")) {
			try {
				const { type, data } = nip19.decode(privateKey);
				if (type !== "nsec") {
					throw new TypeError("Invalid nsec private key format.");
				}
				secretKey = data;
			} catch (error) {
				throw new TypeError(`Invalid nsec private key: ${error instanceof Error ? error.message : String(error)}`);
			}
		} else {
			try {
				secretKey = hexToBytes(privateKey);
			} catch (error) {
				throw new TypeError(`Invalid hex private key: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		this.#privateKey = secretKey;
		this.#relays = relays;
		this.#pool = new SimplePool();
	}

	/**
	 * Calculates the length of a message according to Nostr's algorithm.
	 * All characters are counted as is.
	 * @param {string} message The message to calculate the length of.
	 * @returns {number} The calculated length of the message.
	 */
	calculateMessageLength(message) {
		return [...message].length;
	}

	/**
	 * Posts a note to Nostr relays.
	 * @param {string} message The message to post.
	 * @param {PostOptions} [postOptions] Additional options for the post.
	 * @returns {Promise<NostrPostResponse>} A promise that resolves with the event data.
	 * @throws {Error} When the message fails to post.
	 */
	async post(message, postOptions) {
		if (!message) {
			throw new TypeError("Missing message to post.");
		}

		validatePostOptions(postOptions);

		// Check for images - Nostr doesn't directly support image uploads like other platforms
		// Images would typically be uploaded to external services and referenced by URL
		if (postOptions?.images?.length) {
			throw new Error("Direct image uploads are not supported by Nostr. Please upload images to external services and include URLs in the message.");
		}

		try {
			// Create the event template
			const eventTemplate = {
				kind: 1, // Text note
				created_at: Math.floor(Date.now() / 1000),
				tags: [],
				content: message,
			};

			// Sign the event
			const signedEvent = finalizeEvent(eventTemplate, this.#privateKey);

			// Publish to relays
			const publishedTo = [];

			// Publish to all relays at once
			try {
				const publishPromises = this.#pool.publish(this.#relays, signedEvent);
				
				// Wait for all publish attempts to complete
				const results = await Promise.allSettled(publishPromises);
				
				// Track which relays succeeded
				results.forEach((result, index) => {
					if (result.status === 'fulfilled') {
						publishedTo.push(this.#relays[index]);
					}
					// Silently ignore individual relay failures for now
				});
			} catch {
				// If all fails, try individual relay publishing as fallback
				for (const relay of this.#relays) {
					try {
						const publishPromises = this.#pool.publish([relay], signedEvent);
						await Promise.allSettled(publishPromises);
						publishedTo.push(relay);
					} catch {
						// Silently ignore individual relay failures
					}
				}
			}

			// Check if we successfully published to at least one relay
			if (publishedTo.length === 0) {
				throw new Error("Failed to publish to any relay.");
			}

			return {
				event: signedEvent,
				publishedTo,
			};
		} catch (error) {
			throw new Error(`Failed to post to Nostr: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Extracts a URL from the response.
	 * Since Nostr doesn't have centralized URLs, we'll return a nostr: URI
	 * that represents the event.
	 * @param {NostrPostResponse} response The response from the post method.
	 * @returns {string} The nostr URI for the event.
	 */
	getUrlFromResponse(response) {
		// Create a nostr: URI using the event ID
		// This follows the NIP-21 standard for Nostr URIs
		return `nostr:${response.event.id}`;
	}

	/**
	 * Closes the pool and cleans up resources.
	 */
	close() {
		if (this.#pool) {
			this.#pool.close(this.#relays);
		}
	}
}
