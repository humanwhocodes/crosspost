/**
 * @fileoverview Utilities for posting threads.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { validatePostOptions } from "./options.js";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/** @typedef {import("../types.js").PostThreadEntry} PostThreadEntry */
/** @typedef {import("../types.js").PostThreadOptions} PostThreadOptions */
/** @typedef {import("../types.js").ImageEmbed} ImageEmbed */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * The error thrown when a thread stops partway through. The posts that were
 * published before the failure are live, so they're included on the error.
 */
export class ThreadError extends Error {
	/**
	 * The responses for the posts that were published before the failure.
	 * @type {Array<any>}
	 */
	responses;

	/**
	 * Creates a new instance.
	 * @param {string} message The error message.
	 * @param {Array<any>} responses The responses for the posts that were published.
	 * @param {unknown} [cause] The error that stopped the thread.
	 */
	constructor(message, responses, cause) {
		super(message, { cause });
		this.name = "ThreadError";
		this.responses = responses;
	}
}

/**
 * Validates thread entries so a thread doesn't fail partway through because
 * of bad input.
 * @param {Array<PostThreadEntry>} entries The entries to validate.
 * @returns {void}
 * @throws {TypeError} When the entries are invalid.
 */
export function validateThreadEntries(entries) {
	if (!Array.isArray(entries)) {
		throw new TypeError("Expected an array argument.");
	}

	if (entries.length === 0) {
		throw new TypeError("Expected at least one entry.");
	}

	entries.forEach((entry, index) => {
		if (!entry?.message) {
			throw new TypeError(
				`Missing message in thread entry ${index + 1}.`,
			);
		}

		validatePostOptions({ images: entry.images });
	});
}

/**
 * Posts thread entries in order. Call `validateThreadEntries()` first.
 * @template T
 * @param {Array<PostThreadEntry>} entries The entries to post.
 * @param {PostThreadOptions|undefined} options Options for the thread.
 * @param {(entry: PostThreadEntry, previous: Array<T>) => Promise<T>} postEntry
 *      Posts one entry. Receives the responses for the entries already posted
 *      so it can reply to them.
 * @returns {Promise<Array<T>>} The response for each entry.
 * @throws {ThreadError} When an entry fails to post.
 */
export async function postThreadEntries(entries, options, postEntry) {
	/** @type {Array<T>} */
	const responses = [];

	for (const [index, entry] of entries.entries()) {
		try {
			options?.signal?.throwIfAborted();
			responses.push(await postEntry(entry, responses));
		} catch (error) {
			const reason = error instanceof Error ? error.message : error;

			throw new ThreadError(
				`Failed to post entry ${index + 1} of ${entries.length} in the thread: ${reason}`,
				[...responses],
				error,
			);
		}
	}

	return responses;
}

/**
 * Combines thread entries into a single post for services that can't reply
 * to posts.
 * @param {Array<PostThreadEntry>} entries The entries to combine.
 * @returns {{message: string, images: Array<ImageEmbed>|undefined}} The combined post.
 */
export function joinThreadEntries(entries) {
	const images = entries.flatMap(entry => entry.images ?? []);

	return {
		message: entries.map(entry => entry.message).join("\n\n"),
		images: images.length ? images : undefined,
	};
}

/**
 * Splits text into thread entries at lines that contain only `---`.
 * @param {string} text The text to split.
 * @returns {Array<string>} The non-empty entries, trimmed.
 */
export function splitThread(text) {
	return text
		.split(/^[ \t]*---[ \t]*$/mu)
		.map(entry => entry.trim())
		.filter(Boolean);
}
