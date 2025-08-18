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
	truncateUrl,
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
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_URL_FACET,
						uri: normalizeProtocol(uri),
					},
				]);

				assertByteLocation(truncatedText, result, truncateUrl(uri));
			});

			it("should detect a URL at the start of a string", () => {
				const text = `${uri} is a test.`;
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_URL_FACET,
						uri: normalizeProtocol(uri),
					},
				]);

				assertByteLocation(truncatedText, result, truncateUrl(uri));
			});

			it("should detect a URL in the middle of a string", () => {
				const text = `This is a test ${uri}, of a URL.`;
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_URL_FACET,
						uri: normalizeProtocol(uri),
					},
				]);

				assertByteLocation(truncatedText, result, truncateUrl(uri));
			});

			it("should detect a URL at the end of a string", () => {
				const text = `This is a test of a URL ${uri}.`;
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_URL_FACET,
						uri: normalizeProtocol(uri),
					},
				]);

				assertByteLocation(truncatedText, result, truncateUrl(uri));
			});
		});

		it("should return truncated text and preserve original URI in facets", () => {
			const longUrl =
				"https://example.com/some/really/long/path/that/exceeds/twenty-seven-chars";
			const { facets, text: truncatedText } = detectFacets(longUrl);

			// truncated display should be exactly 27 characters with trailing ...
			const displayed = truncatedText;
			assert.strictEqual(displayed.length, 27);
			assert.strictEqual(displayed.slice(-3), "...");

			// facet should contain the original full URI with protocol
			assert.strictEqual(facets[0].features[0].uri, longUrl);
		});

		it("should handle two long URLs with surrounding text", () => {
			const url1 =
				"https://example.com/some/really/long/path/that/exceeds/twenty-seven-chars-1";
			const url2 =
				"https://example.org/another/really/long/path/that/exceeds/twenty-seven-chars-2";
			const text = `Start text ${url1} middle text ${url2} end text`;

			const { facets, text: truncatedText } = detectFacets(text);

			// truncatedText should contain two truncated URL displays
			const occurrences = (truncatedText.match(/\.\.\./g) || []).length;
			assert.strictEqual(occurrences, 2);

			// Each facet should preserve the original URI
			const uriFeatures = facets.filter(
				f => f.features[0].$type === BLUESKY_URL_FACET,
			);
			assert.strictEqual(uriFeatures.length, 2);
			assert.strictEqual(uriFeatures[0].features[0].uri, url1);
			assert.strictEqual(uriFeatures[1].features[0].uri, url2);

			// full truncated text should match expected constructed with truncateUrl
			const expected = `Start text ${truncateUrl(url1)} middle text ${truncateUrl(url2)} end text`;
			assert.strictEqual(truncatedText, expected);

			// Byte ranges should decode to the displayed (possibly truncated)
			// URL substrings in the posted/truncated text.
			assertByteLocation(
				truncatedText,
				uriFeatures[0],
				truncateUrl(url1),
			);
			assertByteLocation(
				truncatedText,
				uriFeatures[1],
				truncateUrl(url2),
			);
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
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_TAG_FACET,
						tag,
					},
				]);

				assertByteLocation(truncatedText, result, `#${tag}`);
			});

			it("should detect a hashtag at the start of a string", () => {
				const text = `#${tag} is a test.`;
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_TAG_FACET,
						tag,
					},
				]);

				assertByteLocation(truncatedText, result, `#${tag}`);
			});

			it("should detect a hashtag in the middle of a string", () => {
				const text = `This is a test #${tag}, of a hashtag.`;
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_TAG_FACET,
						tag,
					},
				]);

				assertByteLocation(truncatedText, result, `#${tag}`);
			});

			it("should detect a hashtag at the end of a string", () => {
				const text = `This is a test of a hashtag #${tag}.`;
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_TAG_FACET,
						tag,
					},
				]);

				assertByteLocation(truncatedText, result, `#${tag}`);
			});
		});

		it("should detect both URLs and hashtags in the same text", () => {
			const text =
				"Check out https://example.com for #javascript resources!";
			const { facets: results, text: truncatedText } = detectFacets(text);

			// Should have two facets
			assert.strictEqual(results.length, 2);

			// URL facet
			assert.deepEqual(results[0].features, [
				{
					$type: BLUESKY_URL_FACET,
					uri: "https://example.com",
				},
			]);
			assertByteLocation(
				truncatedText,
				results[0],
				truncateUrl("https://example.com"),
			);

			// Hashtag facet
			assert.deepEqual(results[1].features, [
				{
					$type: BLUESKY_TAG_FACET,
					tag: "javascript",
				},
			]);
			assertByteLocation(truncatedText, results[1], "#javascript");
		});

		it("should not detect invalid hashtags", () => {
			const text = "#123 #. ## # #!";
			const { facets: results } = detectFacets(text);
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
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_MENTION_FACET,
						did: handle,
					},
				]);

				assertByteLocation(truncatedText, result, `@${handle}`);
			});

			it("should detect a mention at the start of a string", () => {
				const text = `@${handle} is a test.`;
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_MENTION_FACET,
						did: handle,
					},
				]);

				assertByteLocation(truncatedText, result, `@${handle}`);
			});

			it("should detect a mention in the middle of a string", () => {
				const text = `This is a test @${handle}, of a mention.`;
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_MENTION_FACET,
						did: handle,
					},
				]);

				assertByteLocation(truncatedText, result, `@${handle}`);
			});

			it("should detect a mention at the end of a string", () => {
				const text = `This is a test of a mention @${handle}.`;
				const { facets, text: truncatedText } = detectFacets(text);
				const result = facets[0];
				assert.deepEqual(result.features, [
					{
						$type: BLUESKY_MENTION_FACET,
						did: handle,
					},
				]);

				assertByteLocation(truncatedText, result, `@${handle}`);
			});
		});

		it("should detect mentions in parentheses", () => {
			const text = "Hello (@username) how are you?";
			const { facets, text: truncatedText } = detectFacets(text);
			const result = facets[0];
			assert.deepEqual(result.features, [
				{
					$type: BLUESKY_MENTION_FACET,
					did: "username",
				},
			]);

			assertByteLocation(truncatedText, result, "@username");
		});

		it("should detect multiple mentions in the same text", () => {
			const text = "Hello @alice and @bob, how are you?";
			const { facets: results, text: truncatedText } = detectFacets(text);

			// Should have two facets
			assert.strictEqual(results.length, 2);

			// First mention
			assert.deepEqual(results[0].features, [
				{
					$type: BLUESKY_MENTION_FACET,
					did: "alice",
				},
			]);
			assertByteLocation(truncatedText, results[0], "@alice");

			// Second mention
			assert.deepEqual(results[1].features, [
				{
					$type: BLUESKY_MENTION_FACET,
					did: "bob",
				},
			]);
			assertByteLocation(truncatedText, results[1], "@bob");
		});

		it("should detect mentions, URLs and hashtags in the same text", () => {
			const text =
				"Check out https://example.com and mention @user about #javascript!";
			const { facets: results, text: truncatedText } = detectFacets(text);

			// Should have three facets
			assert.strictEqual(results.length, 3);

			// URL facet
			assert.deepEqual(results[0].features, [
				{
					$type: BLUESKY_URL_FACET,
					uri: "https://example.com",
				},
			]);
			assertByteLocation(
				truncatedText,
				results[0],
				truncateUrl("https://example.com"),
			);

			// Hashtag facet
			assert.deepEqual(results[1].features, [
				{
					$type: BLUESKY_TAG_FACET,
					tag: "javascript",
				},
			]);
			assertByteLocation(truncatedText, results[1], "#javascript");

			// Mention facet
			assert.deepEqual(results[2].features, [
				{
					$type: BLUESKY_MENTION_FACET,
					did: "user",
				},
			]);
			assertByteLocation(truncatedText, results[2], "@user");
		});

		it("should not detect mentions without @ symbol", () => {
			const text = "Hello username how are you?";
			const { facets: results } = detectFacets(text);
			assert.strictEqual(results.length, 0);
		});

		it("should not detect invalid mentions", () => {
			const text = "@ @123 @. @@ @ @!";
			const { facets: results } = detectFacets(text);
			assert.strictEqual(results.length, 0);
		});
	});
});
