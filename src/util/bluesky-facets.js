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
export const BLUESKY_TAG_FACET = "app.bsky.richtext.facet#tag";
export const BLUESKY_MENTION_FACET = "app.bsky.richtext.facet#mention";

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
 * @typedef {Object} TagDetails
 * @property {string} tag The tag of the facet.
 * @property {ByteRange} byteRange The byte range of the facet in the text.
 */

/**
 * @typedef {Object} MentionDetails
 * @property {string} handle The handle of the mentioned user.
 * @property {ByteRange} byteRange The byte range of the facet in the text.
 */

/**
 * @typedef {Object} BlueSkyFacet
 * @property {ByteRange} index The byte range of the facet in the text.
 * @property {Array<BlueSkyURIFacetFeature|BlueSkyTagFacetFeature|BlueSkyMentionFacetFeature>} features The features of the facet.
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
const MENTION_REGEX = /(^|\s|\()(@)([a-zA-Z][a-zA-Z0-9.-]*[a-zA-Z0-9]|[a-zA-Z])(\b)/g;
const URL_REGEX =
	/(^|\s|\()((https?:\/\/[\S]+)|((?<domain>[a-z][a-z0-9]*(\.[a-z0-9]+)+)[\S]*))/gim;
const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu;

/**
 * `\ufe0f` emoji modifier
 * `\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2` zero-width spaces (likely incomplete)
 */
const TAG_REGEX =
	// eslint-disable-next-line no-misleading-character-class
	/(^|\s)[#＃]((?!\ufe0f)[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*[^\d\s\p{P}\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]+[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*)?/gu;

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
 * A Bluesky tag facet feature.
 */
class BlueSkyTagFacetFeature {
	/**
	 * The tag of the facet.
	 * @type {string}
	 */
	tag;

	/**
	 * The type of facet.
	 * @type {string}
	 * @const
	 */
	$type = BLUESKY_TAG_FACET;

	/**
	 * Creates a new instance.
	 * @param {string} tag The tag of the facet.
	 */
	constructor(tag) {
		this.tag = tag;
	}
}

/**
 * A Bluesky mention facet feature.
 */
class BlueSkyMentionFacetFeature {
	/**
	 * The DID of the mentioned user.
	 * Note: When created by detectMentions(), this initially contains the handle.
	 * The BlueSky strategy resolves handles to actual DIDs before posting.
	 * @type {string}
	 */
	did;

	/**
	 * The type of facet.
	 * @type {string}
	 * @const
	 */
	$type = BLUESKY_MENTION_FACET;

	/**
	 * Creates a new instance.
	 * @param {string} did The DID of the mentioned user (initially the handle, resolved by the strategy).
	 */
	constructor(did) {
		this.did = did;
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
 * Detects all hashtags in the given text and returns an array noting the byte location
 * of the hashtags in the text.
 * @param {string} text The text to search.
 * @returns {TagDetails[]} An array of TagDetails objects.
 */
function detectTags(text) {
	const matches = [];
	let match;

	while ((match = TAG_REGEX.exec(text)) !== null) {
		let tag = match[2];

		// Skip if the tag is empty or undefined
		if (!tag) {
			continue;
		}

		// Strip any trailing punctuation (similar to URLs)
		if (TRAILING_PUNCTUATION_REGEX.test(tag)) {
			tag = tag.replace(TRAILING_PUNCTUATION_REGEX, "");
		}

		// Calculate the location of the hashtag (includes the # symbol)
		let start = match.index;

		// Strip any leading whitespace from overall match
		if (LEADING_WHITESPACE_REGEX.test(match[0])) {
			start += 1;
		}

		// Start after the # symbol
		const hashSymbolStart = start;
		const tagEnd = hashSymbolStart + 1 + tag.length;

		matches.push({
			tag,
			byteRange: getByteOffsets(text, hashSymbolStart, tagEnd),
		});
	}

	return matches;
}

/**
 * Detects all mentions in the given text and returns an array noting the byte location
 * of the mentions in the text.
 * @param {string} text The text to search.
 * @returns {MentionDetails[]} An array of MentionDetails objects.
 */
function detectMentions(text) {
	const matches = [];
	let match;

	while ((match = MENTION_REGEX.exec(text)) !== null) {
		let handle = match[3];

		// Skip if the handle is empty or undefined
		if (!handle) {
			continue;
		}

		// Strip any trailing punctuation (similar to URLs)
		if (TRAILING_PUNCTUATION_REGEX.test(handle)) {
			handle = handle.replace(TRAILING_PUNCTUATION_REGEX, "");
		}

		// Calculate the location of the mention (includes the @ symbol)
		let start = match.index;

		// Strip any leading whitespace or punctuation from overall match
		if (LEADING_WHITESPACE_REGEX.test(match[0])) {
			start += 1;
		} else if (match[1] && match[1] !== "") {
			// If there's a prefix character like '(', adjust the start position
			start += match[1].length;
		}

		// Start at the @ symbol position
		const atSymbolStart = start;
		const mentionEnd = atSymbolStart + 1 + handle.length;

		matches.push({
			handle,
			byteRange: getByteOffsets(text, atSymbolStart, mentionEnd),
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
		...detectTags(text).map(tag => ({
			index: tag.byteRange,
			features: [new BlueSkyTagFacetFeature(tag.tag)],
		})),
		...detectMentions(text).map(mention => ({
			index: mention.byteRange,
			features: [new BlueSkyMentionFacetFeature(mention.handle)],
		})),
	];
}
