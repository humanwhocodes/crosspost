/**
 * @fileoverview Tests for Bluesky facets utilities.
 * @author Nicholas C. Zakas
 */

/* global TextEncoder, TextDecoder */

//------------------------------------------------------------------------------
// Imports
//------------------------------------------------------------------------------

import { detectFacets } from "../../src/util/bluesky-facets.js";
import assert from "node:assert";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Asserts that the byte location of a facet is correct.
 * @param {string} text The text to check.
 * @param {URIFacet} facet The facet to check.
 * @param {string} expected The expected value.
 * @throws {AssertionError} Throws if the byte location is incorrect.
 * @returns {void}
 */
function assertByteLocation(text, facet, expected) {
	const { byteStart, byteEnd } = facet.index;
	const buffer = encoder.encode(text);
	const actual = decoder.decode(buffer.slice(byteStart, byteEnd));
	assert.strictEqual(actual, expected);
}

/**
 * Normalizes a URI to include the protocol.
 * @param {string} uri The URI to normalize.
 * @returns {string} The normalized URI.
 */
function normalizeProtocol(uri) {
	if (!uri.startsWith("http")) {
		uri = `https://${uri}`;
	}

	return uri;
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("detectFacets()", () => {
	[
		"https://example.com",
		"https://example.co.uk/path",
		"http://test.org/path",
		"https://subdomain.example.net/path/to/resource",
		"http://example.com?query=string",
		"https://example.com#hash",
		"https://example.com/path?query=string#hash",
		"example.com/no-protocol",
		"test.org/path/no-protocol",
	].forEach(uri => {
		it("should detect a URL all alone", () => {
			const text = `${uri}`;
			const result = detectFacets(text)[0];
			assert.deepEqual(result.features, [
				{
					$type: "app.bsky.richtext.facet#link",
					uri: normalizeProtocol(uri),
				},
			]);

			assertByteLocation(text, result, uri);
		});

		it("should detect a URL at the start of a string", () => {
			const text = `${uri} is a test.`;
			const result = detectFacets(text)[0];
			assert.deepEqual(result.features, [
				{
					$type: "app.bsky.richtext.facet#link",
					uri: normalizeProtocol(uri),
				},
			]);

			assertByteLocation(text, result, uri);
		});

		it("should detect a URL in the middle of a string", () => {
			const text = `This is a test ${uri}, of a URL.`;
			const result = detectFacets(text)[0];
			assert.deepEqual(result.features, [
				{
					$type: "app.bsky.richtext.facet#link",
					uri: normalizeProtocol(uri),
				},
			]);

			assertByteLocation(text, result, uri);
		});

		it("should detect a URL at the end of a string", () => {
			const text = `This is a test of a URL ${uri}.`;
			const result = detectFacets(text)[0];
			assert.deepEqual(result.features, [
				{
					$type: "app.bsky.richtext.facet#link",
					uri: normalizeProtocol(uri),
				},
			]);

			assertByteLocation(text, result, uri);
		});
	});
});
