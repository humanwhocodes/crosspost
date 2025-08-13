/**
 * @fileoverview Nostr-related utility functions.
 * @author Nicholas C. Zakas
 */
//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { bech32 } from "bech32";
import { Buffer } from "node:buffer";

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Converts a Nostr private key in `nsec` format to a hex string.
 * @param {string} nsec The Nostr private key.
 * @returns {string} The private key as a hex string.
 * @throws {Error} If the private key is invalid.
 */
export function nsecToHex(nsec) {
	if (typeof nsec !== "string" || !nsec.startsWith("nsec")) {
		throw new Error("Invalid Nostr private key.");
	}

	const { words } = bech32.decode(nsec);
	const privateKeyBytes = bech32.fromWords(words);
	return Buffer.from(privateKeyBytes).toString("hex");
}
