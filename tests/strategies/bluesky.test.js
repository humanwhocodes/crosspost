/**
 * @fileoverview Tests for the BlueskyStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { BlueskyStrategy } from "../../src/strategies/bluesky.js";
import { MockServer, FetchMocker } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const HOST = "test.social";
const CREATE_SESSION_URL = `/xrpc/com.atproto.server.createSession`;
const CREATE_RECORD_URL = `/xrpc/com.atproto.repo.createRecord`;
const UPLOAD_BLOB_URL = `/xrpc/com.atproto.repo.uploadBlob`;
const RESOLVE_HANDLE_URL = `/xrpc/com.atproto.identity.resolveHandle`;

const CREATE_SESSION_RESPONSE = {
	did: "did:plc:rzf7l6olyl67yfy2jwufdq7f",
	didDoc: {
		"@context": [
			"https://www.w3.org/ns/did/v1",
			"https://w3id.org/security/multikey/v1",
			"https://w3id.org/security/suites/secp256k1-2019/v1",
		],
		id: "did:plc:rzf7l6olyl67yfy2jwufdq7f",
		alsoKnownAs: ["at://example.com"],
	},
	handle: "example.com",
	email: "nicholas@example.com",
	emailConfirmed: true,
	emailAuthFactor: false,
	accessJwt: "foobar",
	refreshJwt: "bazqux",
	// accessJwt: "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJFUzI1NksifQ.eyJzY29wZSI6ImNvbS5hdHByb3RvLmFwcFBhc3MiLCJzdWIiOiJkaWQ6cGxjOnJ6ZjdsNm9seWw2N3lmeTJqd3VmZHE3ZiIsImlhdCI6MTczMTYxMzYwNCwiZXhwIjoxNzMxNjIwODA0LCJhdWQiOiJkaWQ6d2ViOmxpb25zbWFuZS51cy1lYXN0Lmhvc3QuYnNreS5uZXR3b3JrIn0.xWhxxoEvQMoyTpcr509JBlqDnzbQk1pNfOyOz1EtDS0AkOadAoqMpdwXzcLX85JiDftFRiWFpxCOpTQxQz_JOA",
	// refreshJwt: "eyJ0eXAiOiJyZWZyZXNoK2p3dCIsImFsZyI6IkVTMjU2SyJ9.eyJzY29wZSI6ImNvbS5hdHByb3RvLnJlZnJlc2giLCJzdWIiOiJkaWQ6cGxjOnJ6ZjdsNm9seWw2N3lmeTJqd3VmZHE3ZiIsImF1ZCI6ImRpZDp3ZWI6YnNreS5zb2NpYWwiLCJqdGkiOiJRSlRoZ1FqY0N4T1JkRG40ZXZNZXp5OFpwWUZtTUwrUm9tbGFNQnpnRTZFIiwiaWF0IjoxNzMxNjEzNjA0LCJleHAiOjE3MzkzODk2MDR9.y7i7tHuQgr1MOH700UfkGXJcQgRpLzvyzdr5IWqKIxPI8kohZG46ZrrgbSn_e3njOK32o7uA5p_PT3Yi8BB6dg",
	active: true,
};

const CREATE_RECORD_RESPONSE = {
	uri: "at://did:plc:abcxyz/app.bsky.feed.post/abcxyz",
	cid: "bafyreieya2tik2z5e2jjin3qozcgzvvbirwo6di6gjftq45mr5ujkqe44i",
	commit: {
		cid: "bafyreicuzemahv3dpft5kydgmutym5yqt4fhw6xfbmc3g2l2den5qtegjy",
		rev: "3lawmuwiktf2w",
	},
	validationStatus: "valid",
};

const UPLOAD_BLOB_RESPONSE = {
	blob: {
		$type: "blob",
		ref: {
			$link: "bafkreihankqxww2ue7f2uqgnexvww2ue7f2uq",
		},
		mimeType: "image/jpeg",
		size: 1234,
	},
};

const server = new MockServer(`https://${HOST}`);
const fetchMocker = new FetchMocker({
	servers: [server],
});

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("BlueskyStrategy", function () {
	let options;

	beforeEach(function () {
		options = {
			identifier: "testuser",
			password: "password",
			host: HOST,
		};
	});

	describe("constructor", function () {
		it("should throw a TypeError if identifier is missing", function () {
			assert.throws(
				() => {
					new BlueskyStrategy({ ...options, identifier: undefined });
				},
				TypeError,
				"Missing identifier.",
			);
		});

		it("should throw a TypeError if password is missing", function () {
			assert.throws(
				() => {
					new BlueskyStrategy({ ...options, password: undefined });
				},
				TypeError,
				"Missing password.",
			);
		});

		it("should throw a TypeError if host is missing", function () {
			assert.throws(
				() => {
					new BlueskyStrategy({ ...options, host: undefined });
				},
				TypeError,
				"Missing host.",
			);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new BlueskyStrategy(options);
			assert.strictEqual(strategy.id, "bluesky");
			assert.strictEqual(strategy.name, "Bluesky");
		});
	});

	describe("post", function () {
		let strategy;

		beforeEach(function () {
			strategy = new BlueskyStrategy(options);
			fetchMocker.mockGlobal();
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an Error if message is missing", async function () {
			await assert.rejects(
				async () => {
					await strategy.post();
				},
				TypeError,
				"Missing message to post.",
			);
		});

		it("should successfully post a message", async function () {
			const text = "Hello, world! https://example.com";

			server.post(
				{
					url: CREATE_SESSION_URL,
					headers: {
						"content-type": "application/json",
					},
					body: {
						identifier: options.identifier,
						password: options.password,
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_SESSION_RESPONSE,
				},
			);

			server.post(
				{
					url: CREATE_RECORD_URL,
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${CREATE_SESSION_RESPONSE.accessJwt}`,
					},
					body: {
						repo: CREATE_SESSION_RESPONSE.did,
						collection: "app.bsky.feed.post",
						record: {
							$type: "app.bsky.feed.post",
							text,
							facets: [
								{
									index: {
										byteStart: 14,
										byteEnd: 33,
									},
									features: [
										{
											$type: "app.bsky.richtext.facet#link",
											uri: "https://example.com",
										},
									],
								},
							],
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_RECORD_RESPONSE,
				},
			);

			const response = await strategy.post(text);
			assert.deepStrictEqual(response, CREATE_RECORD_RESPONSE);
		});

		it("should handle create session request failure", async function () {
			server.post(CREATE_SESSION_URL, {
				status: 400,
				body: {
					error: "Invalid credentials",
					message: "The credentials provided are invalid.",
				},
			});

			await assert.rejects(async () => {
				await strategy.post("Hello, world!");
			}, /The credentials provided are invalid/);
		});

		it("should handle post message request failure", async function () {
			const text = "Hello, world! https://example.com";

			server.post(
				{
					url: CREATE_SESSION_URL,
					headers: {
						"content-type": "application/json",
					},
					body: {
						identifier: options.identifier,
						password: options.password,
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_SESSION_RESPONSE,
				},
			);

			server.post(CREATE_RECORD_URL, {
				status: 400,
				body: {
					error: "InvalidToken",
					message: "The token is invalid.",
				},
			});

			await assert.rejects(async () => {
				await strategy.post(text);
			}, /The token is invalid/);
		});

		it("should successfully post a message with emojis", async function () {
			const text = "Hello, world! 🌍 ✨";

			server.post(
				{
					url: CREATE_SESSION_URL,
					headers: {
						"content-type": "application/json",
					},
					body: {
						identifier: options.identifier,
						password: options.password,
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_SESSION_RESPONSE,
				},
			);

			server.post(
				{
					url: CREATE_RECORD_URL,
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${CREATE_SESSION_RESPONSE.accessJwt}`,
					},
					body: {
						repo: CREATE_SESSION_RESPONSE.did,
						collection: "app.bsky.feed.post",
						record: {
							$type: "app.bsky.feed.post",
							text,
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_RECORD_RESPONSE,
				},
			);

			const response = await strategy.post(text);
			assert.deepStrictEqual(response, CREATE_RECORD_RESPONSE);
		});

		it("should throw a TypeError if images is not an array", async function () {
			await assert.rejects(
				async () => {
					await strategy.post("Hello world", {
						images: "not an array",
					});
				},
				TypeError,
				"images must be an array.",
			);
		});

		it("should throw a TypeError if image is missing data", async function () {
			await assert.rejects(
				async () => {
					await strategy.post("Hello world", {
						images: [{ alt: "test" }],
					});
				},
				TypeError,
				"Image must have data.",
			);
		});

		it("should throw a TypeError if image data is not a Uint8Array", async function () {
			await assert.rejects(
				async () => {
					await strategy.post("Hello world", {
						images: [
							{
								alt: "test",
								data: "not a Uint8Array",
							},
						],
					});
				},
				TypeError,
				"Image data must be a Uint8Array.",
			);
		});

		it("should successfully post a message with an image", async function () {
			const text = "Hello, world!";
			const imageData = new Uint8Array([1, 2, 3, 4]);

			server.post(
				{
					url: CREATE_SESSION_URL,
					headers: {
						"content-type": "application/json",
					},
					body: {
						identifier: options.identifier,
						password: options.password,
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_SESSION_RESPONSE,
				},
			);

			server.post(
				{
					url: UPLOAD_BLOB_URL,
					headers: {
						"content-type": "*/*",
						authorization: `Bearer ${CREATE_SESSION_RESPONSE.accessJwt}`,
					},
					body: imageData.buffer,
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: UPLOAD_BLOB_RESPONSE,
				},
			);

			server.post(
				{
					url: CREATE_RECORD_URL,
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${CREATE_SESSION_RESPONSE.accessJwt}`,
					},
					body: {
						repo: CREATE_SESSION_RESPONSE.did,
						collection: "app.bsky.feed.post",
						record: {
							$type: "app.bsky.feed.post",
							text,
							embed: {
								$type: "app.bsky.embed.images",
								images: [
									{
										alt: "test image",
										image: UPLOAD_BLOB_RESPONSE.blob,
									},
								],
							},
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_RECORD_RESPONSE,
				},
			);

			const response = await strategy.post(text, {
				images: [
					{
						alt: "test image",
						data: imageData,
					},
				],
			});
			assert.deepStrictEqual(response, CREATE_RECORD_RESPONSE);
		});

		it("should handle image upload failure", async function () {
			const text = "Hello, world!";
			const imageData = new Uint8Array([1, 2, 3, 4]);

			server.post(
				{
					url: CREATE_SESSION_URL,
					headers: {
						"content-type": "application/json",
					},
					body: {
						identifier: options.identifier,
						password: options.password,
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_SESSION_RESPONSE,
				},
			);

			server.post(UPLOAD_BLOB_URL, {
				status: 400,
				body: {
					error: "InvalidBlob",
					message: "The blob is invalid.",
				},
			});

			await assert.rejects(async () => {
				await strategy.post(text, {
					images: [
						{
							alt: "test image",
							data: imageData,
						},
					],
				});
			}, /The blob is invalid/);
		});

		it("should abort when signal is triggered", async function () {
			const text = "Hello, world!";
			const controller = new AbortController();

			server.post(
				{
					url: CREATE_SESSION_URL,
					headers: {
						"content-type": "application/json",
					},
					body: {
						identifier: options.identifier,
						password: options.password,
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_SESSION_RESPONSE,
					delay: 50,
				},
			);

			// Abort after a short delay
			setTimeout(() => controller.abort(), 10);

			await assert.rejects(async () => {
				await strategy.post(text, { signal: controller.signal });
			}, /abort/u);
		});

		it("should successfully post a message with mentions", async function () {
			const text = "Hello @alice and @bob.example.com!";

			// Mock session creation
			server.post(
				{
					url: CREATE_SESSION_URL,
					headers: {
						"content-type": "application/json",
					},
					body: {
						identifier: options.identifier,
						password: options.password,
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_SESSION_RESPONSE,
				},
			);

			// Mock handle resolution for alice
			server.get(
				{
					url: RESOLVE_HANDLE_URL,
					query: { handle: "alice" },
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: { did: "did:plc:alice123" },
				},
			);

			// Mock handle resolution for bob.example.com
			server.get(
				{
					url: RESOLVE_HANDLE_URL,
					query: { handle: "bob.example.com" },
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: { did: "did:plc:bob456" },
				},
			);

			// Mock post creation
			server.post(
				{
					url: CREATE_RECORD_URL,
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${CREATE_SESSION_RESPONSE.accessJwt}`,
					},
					body: {
						repo: CREATE_SESSION_RESPONSE.did,
						collection: "app.bsky.feed.post",
						record: {
							$type: "app.bsky.feed.post",
							text,
							facets: [
								{
									index: {
										byteStart: 6,
										byteEnd: 12,
									},
									features: [
										{
											$type: "app.bsky.richtext.facet#mention",
											did: "did:plc:alice123",
										},
									],
								},
								{
									index: {
										byteStart: 17,
										byteEnd: 33,
									},
									features: [
										{
											$type: "app.bsky.richtext.facet#mention",
											did: "did:plc:bob456",
										},
									],
								},
							],
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_RECORD_RESPONSE,
				},
			);

			const result = await strategy.post(text);

			assert.strictEqual(result.uri, CREATE_RECORD_RESPONSE.uri);
			assert.strictEqual(result.cid, CREATE_RECORD_RESPONSE.cid);
		});

		it("should handle mention resolution failure gracefully", async function () {
			const text = "Hello @nonexistent!";

			// Mock session creation
			server.post(
				{
					url: CREATE_SESSION_URL,
					headers: {
						"content-type": "application/json",
					},
					body: {
						identifier: options.identifier,
						password: options.password,
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_SESSION_RESPONSE,
				},
			);

			// Mock handle resolution failure
			server.get(
				{
					url: RESOLVE_HANDLE_URL,
					query: { handle: "nonexistent" },
				},
				{
					status: 400,
					headers: {
						"content-type": "application/json",
					},
					body: { 
						error: "InvalidRequest",
						message: "Handle not found"
					},
				},
			);

			// Mock post creation without mention facets
			server.post(
				{
					url: CREATE_RECORD_URL,
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${CREATE_SESSION_RESPONSE.accessJwt}`,
					},
					body: {
						repo: CREATE_SESSION_RESPONSE.did,
						collection: "app.bsky.feed.post",
						record: {
							$type: "app.bsky.feed.post",
							text,
							facets: [], // No mention facets due to resolution failure
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_RECORD_RESPONSE,
				},
			);

			const result = await strategy.post(text);

			assert.strictEqual(result.uri, CREATE_RECORD_RESPONSE.uri);
			assert.strictEqual(result.cid, CREATE_RECORD_RESPONSE.cid);
		});
	});

	describe("getUrlFromResponse", function () {
		let strategy;

		beforeEach(function () {
			strategy = new BlueskyStrategy(options);
		});

		it("should generate the correct URL from a response", function () {
			const response = {
				uri: "at://did:plc:abcxyz/app.bsky.feed.post/123456789",
				cid: "bafyreieya2tik2z5e2jjin3qozcgzvvbirwo6di6gjftq45mr5ujkqe44i",
			};

			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(
				url,
				`https://bsky.app/profile/${options.identifier}/post/123456789`,
			);
		});

		it("should throw an error when the URI is missing", function () {
			const response = {
				cid: "bafyreieya2tik2z5e2jjin3qozcgzvvbirwo6di6gjftq45mr5ujkqe44i",
			};

			assert.throws(() => {
				strategy.getUrlFromResponse(response);
			}, /Post URI not found in response/);
		});

		it("should throw an error when the response is null", function () {
			assert.throws(() => {
				strategy.getUrlFromResponse(null);
			}, /Post URI not found in response/);
		});
	});

	describe("MAX_MESSAGE_LENGTH", () => {
		let strategy;
		beforeEach(() => {
			strategy = new BlueskyStrategy({
				identifier: "user.bsky.social",
				password: "pw",
				host: "bsky.social",
			});
		});
		it("should have a MAX_MESSAGE_LENGTH property", () => {
			assert.ok(
				Object.prototype.hasOwnProperty.call(
					strategy,
					"MAX_MESSAGE_LENGTH",
				),
				"MAX_MESSAGE_LENGTH property is missing",
			);
			assert.strictEqual(typeof strategy.MAX_MESSAGE_LENGTH, "number");
		});
	});

	describe("calculateMessageLength", () => {
		let strategy;
		beforeEach(() => {
			strategy = new BlueskyStrategy({
				identifier: "user.bsky.social",
				password: "pw",
				host: "bsky.social",
			});
		});
		it("should calculate length of plain text correctly", () => {
			const msg = "Hello world!";
			assert.strictEqual(
				strategy.calculateMessageLength(msg),
				msg.length,
			);
		});
		it("should count URLs as 27 characters", () => {
			const msg =
				"Check this out: https://example.com/abcde and http://foo.bar";
			const urlCount = 2;
			const expected =
				msg.replace(/https?:\/\/[^\s]+/g, "").length + urlCount * 27;
			assert.strictEqual(strategy.calculateMessageLength(msg), expected);
		});
	});
});
