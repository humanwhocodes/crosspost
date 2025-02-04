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

		it("should create an instance if all options are provided", function () {
			const strategy = new BlueskyStrategy(options);
			assert.strictEqual(strategy.name, "bluesky");
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
					matchPartialBody: true,
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

		it("should handle post request failure", async function () {
			server.post(CREATE_SESSION_URL, 403);

			await assert.rejects(async () => {
				await strategy.post("Hello, world!");
			}, /Forbidden/);
		});
	});
});
