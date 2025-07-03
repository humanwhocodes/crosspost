/**
 * @fileoverview Tests for Bluesky facets utilities.
 * @author Nicholas C. Zakas
 */

/* global TextEncoder, TextDecoder */

//------------------------------------------------------------------------------
// Imports
//------------------------------------------------------------------------------

import {
	detectFacets,
	BLUESKY_URL_FACET,
	BLUESKY_TAG_FACET,
	BLUESKY_MENTION_FACET,
} from "../../src/util/bluesky-facets.js";
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
	describe("URL detection", () => {
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
						$type: BLUESKY_URL_FACET,
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
						$type: BLUESKY_URL_FACET,
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
						$type: BLUESKY_URL_FACET,
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
						$type: BLUESKY_URL_FACET,
						uri: normalizeProtocol(uri),
					},
				]);

				assertByteLocation(text, result, uri);
			});
		});
	});

	describe("Hashtag detection", () => {
		[
			"javascript",
			"coding123",
			"crosspost",
			"bluesky",
			"react-native",
			"web_development",
		].forEach(tag => {
			it("should detect a hashtag all alone", () => {
				const text = `#${tag}`;
				const result = detectFacets(text)[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_TAG_FACET,
						tag,
					},
				]);

				assertByteLocation(text, result, `#${tag}`);
			});

			it("should detect a hashtag at the start of a string", () => {
				const text = `#${tag} is a test.`;
				const result = detectFacets(text)[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_TAG_FACET,
						tag,
					},
				]);

				assertByteLocation(text, result, `#${tag}`);
			});

			it("should detect a hashtag in the middle of a string", () => {
				const text = `This is a test #${tag}, of a hashtag.`;
				const result = detectFacets(text)[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_TAG_FACET,
						tag,
					},
				]);

				assertByteLocation(text, result, `#${tag}`);
			});

			it("should detect a hashtag at the end of a string", () => {
				const text = `This is a test of a hashtag #${tag}.`;
				const result = detectFacets(text)[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_TAG_FACET,
						tag,
					},
				]);

				assertByteLocation(text, result, `#${tag}`);
			});
		});

		it("should detect both URLs and hashtags in the same text", () => {
			const text =
				"Check out https://example.com for #javascript resources!";
			const results = detectFacets(text);

			// Should have two facets
			assert.strictEqual(results.length, 2);

			// URL facet
			assert.deepEqual(results[0].features, [
				{
					$type: BLUESKY_URL_FACET,
					uri: "https://example.com",
				},
			]);
			assertByteLocation(text, results[0], "https://example.com");

			// Hashtag facet
			assert.deepEqual(results[1].features, [
				{
					$type: BLUESKY_TAG_FACET,
					tag: "javascript",
				},
			]);
			assertByteLocation(text, results[1], "#javascript");
		});

		it("should not detect invalid hashtags", () => {
			const text = "#123 #. ## # #!";
			const results = detectFacets(text);
			assert.strictEqual(results.length, 0);
		});
	});

	describe("Mention detection", () => {
		[
			"username",
			"user.name",
			"user-name",
			"user123",
			"test.user",
			"example.com",
		].forEach(handle => {
			it("should detect a mention all alone", () => {
				const text = `@${handle}`;
				const result = detectFacets(text)[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_MENTION_FACET,
						did: handle,
					},
				]);

				assertByteLocation(text, result, `@${handle}`);
			});

			it("should detect a mention at the start of a string", () => {
				const text = `@${handle} is a test.`;
				const result = detectFacets(text)[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_MENTION_FACET,
						did: handle,
					},
				]);

				assertByteLocation(text, result, `@${handle}`);
			});

			it("should detect a mention in the middle of a string", () => {
				const text = `This is a test @${handle}, of a mention.`;
				const result = detectFacets(text)[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_MENTION_FACET,
						did: handle,
					},
				]);

				assertByteLocation(text, result, `@${handle}`);
			});

			it("should detect a mention at the end of a string", () => {
				const text = `This is a test of a mention @${handle}.`;
				const result = detectFacets(text)[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_MENTION_FACET,
						did: handle,
					},
				]);

				assertByteLocation(text, result, `@${handle}`);
			});
		});

		it("should detect mentions in parentheses", () => {
			const text = "Hello (@username) how are you?";
			const result = detectFacets(text)[0];
			assert.deepEqual(result.features, [
				{
					$type: BLUESKY_MENTION_FACET,
					did: "username",
				},
			]);

			assertByteLocation(text, result, "@username");
		});

		it("should detect multiple mentions in the same text", () => {
			const text = "Hello @alice and @bob, how are you?";
			const results = detectFacets(text);

			// Should have two facets
			assert.strictEqual(results.length, 2);

			// First mention
			assert.deepEqual(results[0].features, [
				{
					$type: BLUESKY_MENTION_FACET,
					did: "alice",
				},
			]);
			assertByteLocation(text, results[0], "@alice");

			// Second mention
			assert.deepEqual(results[1].features, [
				{
					$type: BLUESKY_MENTION_FACET,
					did: "bob",
				},
			]);
			assertByteLocation(text, results[1], "@bob");
		});

		it("should detect mentions, URLs and hashtags in the same text", () => {
			const text =
				"Check out https://example.com and mention @user about #javascript!";
			const results = detectFacets(text);

			// Should have three facets
			assert.strictEqual(results.length, 3);

			// URL facet
			assert.deepEqual(results[0].features, [
				{
					$type: BLUESKY_URL_FACET,
					uri: "https://example.com",
				},
			]);
			assertByteLocation(text, results[0], "https://example.com");

			// Hashtag facet
			assert.deepEqual(results[1].features, [
				{
					$type: BLUESKY_TAG_FACET,
					tag: "javascript",
				},
			]);
			assertByteLocation(text, results[1], "#javascript");

			// Mention facet
			assert.deepEqual(results[2].features, [
				{
					$type: BLUESKY_MENTION_FACET,
					did: "user",
				},
			]);
			assertByteLocation(text, results[2], "@user");
		});

		it("should not detect mentions without @ symbol", () => {
			const text = "Hello username how are you?";
			const results = detectFacets(text);
			assert.strictEqual(results.length, 0);
		});

		it("should not detect invalid mentions", () => {
			const text = "@ @123 @. @@ @ @!";
			const results = detectFacets(text);
			assert.strictEqual(results.length, 0);
		});
	});
});
