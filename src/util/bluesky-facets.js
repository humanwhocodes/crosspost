/**
 * @fileoverview Utilities for detecting Bluesky facets in text.
 * @author Nicholas C. Zakas
 */

/* global TextEncoder */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { createRequire } from "node:module";

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

export const BLUESKY_URL_FACET = "app.bsky.richtext.facet#link";

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} ByteRange
 * @property {number} byteStart The byte offset of the start of the range.
 * @property {number} byteEnd The byte offset of the end of
 */

/**
 * @typedef {Object} URIDetails
 * @property {string} uri The URI of the facet.
 * @property {ByteRange} byteRange The byte range of the facet in the text.
 */

/**
 * @typedef {Object} BlueSkyFacet
 * @property {ByteRange} index The byte range of the facet in the text.
 * @property {Array<BlueSkyURIFacetFeature>} features The features of the facet.
 */

//-----------------------------------------------------------------------------
// Patterns
//-----------------------------------------------------------------------------

/*
 * The following four patterns were taken from the atproto project.
 * https://github.com/bluesky-social/atproto
 *
 * Copyright (c) 2022-2024 Bluesky PBC, and Contributors
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// const MENTION_REGEX = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g
const URL_REGEX =
	/(^|\s|\()((https?:\/\/[\S]+)|((?<domain>[a-z][a-z0-9]*(\.[a-z0-9]+)+)[\S]*))/gim;
const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu;

/**
 * `\ufe0f` emoji modifier
 * `\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2` zero-width spaces (likely incomplete)
 */
// const TAG_REGEX =
//     // eslint-disable-next-line no-misleading-character-class
//     /(^|\s)[#＃]((?!\ufe0f)[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*[^\d\s\p{P}\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]+[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*)?/gu

const LEADING_WHITESPACE_REGEX = /^\s/u;

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const require = createRequire(import.meta.url);
const tlds = require("tlds");
const encoder = new TextEncoder();

/**
 * A Bluesky URI facet feature.
 */
class BlueSkyURIFacetFeature {
	/**
	 * The URI of the facet.
	 * @type {string}
	 */
	uri;

	/**
	 * The type of facet.
	 * @type {string}
	 * @const
	 */
	$type = BLUESKY_URL_FACET;

	/**
	 * Creates a new instance.
	 * @param {string} uri The URI of the facet.
	 */
	constructor(uri) {
		this.uri = uri;
	}
}

/**
 * Determines if a given domain contains a valid TLD.
 * @param {string} domain The domain to check.
 * @returns {boolean} True if the domain has a valid TLD, false otherwise.
 */
function hasValidTLD(domain) {
	const dotLocation = domain.lastIndexOf(".");
	const tld = domain.slice(dotLocation + 1);
	return tlds.indexOf(tld) !== -1;
}

/**
 * Gets the byte offsets for a given range of text.
 * @param {string} text The text to search.
 * @param {number} start The start of the range.
 * @param {number} end The end of the range.
 * @returns {ByteRange} An object with `byteStart` and `byteEnd` properties.
 */
function getByteOffsets(text, start, end) {
	return {
		byteStart: encoder.encode(text.slice(0, start)).byteLength,
		byteEnd: encoder.encode(text.slice(0, end)).byteLength,
	};
}

/**
 * Detects all URLs in the given text and returns an array noting the byte location
 * of the URLs in the text.
 * @param {string} text The text to search.
 * @returns {URIDetails[]} An array of URIFacet objects.
 */
function detectURLs(text) {
	const matches = [];
	let match;

	while ((match = URL_REGEX.exec(text)) !== null) {
		const original = match[2];
		let uri = original;

		// if it doesn't start with http then we need to check the domain
		if (!uri.startsWith("http")) {
			const domain = match.groups?.domain;

			if (!domain || !hasValidTLD(domain)) {
				continue;
			}

			// we made it here so let's add the protocol before moving on
			uri = `https://${uri}`;
		}

		// now calculate the location of the URL
		let start = match.index;

		// strip any leading whitespace from overall match
		if (LEADING_WHITESPACE_REGEX.test(match[0])) {
			start += 1;
		}

		let end = start + original.length;

		// strip any ending punctation
		if (TRAILING_PUNCTUATION_REGEX.test(uri)) {
			uri = uri.replace(TRAILING_PUNCTUATION_REGEX, "");
			end -= 1;
		}

		matches.push({
			uri,
			byteRange: getByteOffsets(text, start, end),
		});
	}

	return matches;
}

/**
 * Detects rich text facets in the given text.
 * @param {string} text The text to search.
 * @returns {Array<BlueSkyFacet>} An array of BlueSkyFacet objects.
 */
export function detectFacets(text) {
	return [
		...detectURLs(text).map(url => ({
			index: url.byteRange,
			features: [new BlueSkyURIFacetFeature(url.uri)],
		})),
	];
}
