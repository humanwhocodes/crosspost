/**
 * @fileoverview Tests for the LinkedInStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { LinkedInStrategy } from "../../src/strategies/linkedin.js";
import { MockServer, FetchMocker } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const ACCESS_TOKEN = "test-token-123";
const POST_URL = "/v2/ugcPosts";

const CREATE_POST_RESPONSE = {
	id: "urn:li:share:123456789",
	status: "SUCCESS",
};

const USER_INFO_URL = "/v2/userinfo";
const USER_INFO_RESPONSE = {
	sub: "123456789",
	name: "Test User",
	given_name: "Test",
	family_name: "User",
	picture: "https://example.com/photo.jpg",
	locale: {
		country: "US",
		language: "en",
	},
};

const server = new MockServer("https://api.linkedin.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("LinkedInStrategy", () => {
	describe("constructor", () => {
		it("should throw a TypeError if access token is missing", () => {
			assert.throws(
				() => {
					new LinkedInStrategy({});
				},
				TypeError,
				"Missing access token.",
			);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new LinkedInStrategy({
				accessToken: ACCESS_TOKEN,
			});
			assert.strictEqual(strategy.id, "linkedin");
			assert.strictEqual(strategy.name, "LinkedIn");
		});
	});

	describe("post", () => {
		const options = { accessToken: ACCESS_TOKEN };
		const UPLOAD_REGISTER_URL = "/v2/assets?action=registerUpload";
		const UPLOAD_URL = "https://example.com/upload";

		beforeEach(() => {
			fetchMocker.mockGlobal();

			// Mock user info endpoint
			server.get(
				{
					url: USER_INFO_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
					},
				},
				{
					status: 200,
					body: USER_INFO_RESPONSE,
				},
			);
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an Error if message is missing", async () => {
			const strategy = new LinkedInStrategy({
				...options,
			});
			await assert.rejects(
				async () => {
					await strategy.post();
				},
				TypeError,
				"Missing message to post.",
			);
		});

		it("should successfully post a message", async () => {
			const text = "Hello, LinkedIn world!";
			const strategy = new LinkedInStrategy({
				...options,
				accessToken: ACCESS_TOKEN,
			});

			server.post(
				{
					url: POST_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
						"x-restli-protocol-version": "2.0.0",
					},
					body: {
						author: `urn:li:person:${USER_INFO_RESPONSE.sub}`,
						lifecycleState: "PUBLISHED",
						specificContent: {
							"com.linkedin.ugc.ShareContent": {
								shareCommentary: {
									text,
								},
								shareMediaCategory: "NONE",
							},
						},
						visibility: {
							"com.linkedin.ugc.MemberNetworkVisibility":
								"PUBLIC",
						},
					},
				},
				{
					status: 200,
					body: CREATE_POST_RESPONSE,
				},
			);

			const response = await strategy.post(text);
			assert.deepStrictEqual(response, CREATE_POST_RESPONSE);
		});

		it("should successfully post a message with an image", async () => {
			const text = "Hello, LinkedIn world!";
			const imageData = new Uint8Array([1, 2, 3, 4]);
			const strategy = new LinkedInStrategy(options);

			// Mock image upload registration endpoint
			server.post(
				{
					url: UPLOAD_REGISTER_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
					},
				},
				{
					status: 200,
					body: {
						value: {
							asset: "urn:li:image:123456789",
							uploadMechanism: {
								"com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest":
									{
										uploadUrl: UPLOAD_URL,
									},
							},
						},
					},
				},
			);

			// Mock image upload endpoint
			server.post(
				{
					url: UPLOAD_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "image/*",
					},
					body: imageData.buffer,
				},
				{
					status: 200,
				},
			);

			server.post(
				{
					url: POST_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
						"x-restli-protocol-version": "2.0.0",
					},
					body: {
						author: `urn:li:person:${USER_INFO_RESPONSE.sub}`,
						lifecycleState: "PUBLISHED",
						specificContent: {
							"com.linkedin.ugc.ShareContent": {
								shareCommentary: {
									text,
								},
								shareMediaCategory: "IMAGE",
								media: [
									{
										status: "READY",
										description: {
											text: "Test image",
										},
										media: "urn:li:image:123456789",
										title: {
											text: "",
										},
									},
								],
							},
						},
						visibility: {
							"com.linkedin.ugc.MemberNetworkVisibility":
								"PUBLIC",
						},
					},
				},
				{
					status: 200,
					body: CREATE_POST_RESPONSE,
				},
			);

			const response = await strategy.post(text, {
				images: [
					{
						alt: "Test image",
						data: imageData,
					},
				],
			});

			assert.deepStrictEqual(response, CREATE_POST_RESPONSE);
		});

		it("should handle post request failure", async () => {
			server.post(POST_URL, {
				status: 403,
				body: {
					message: "Forbidden",
				},
			});

			const strategy = new LinkedInStrategy(options);

			await assert.rejects(async () => {
				await strategy.post("Hello world!");
			}, /403 Failed to create post/);
		});

		it("should abort when signal is triggered", async () => {
			const text = "Hello, LinkedIn world!";
			const strategy = new LinkedInStrategy(options);
			const controller = new AbortController();

			server.get(
				{
					url: USER_INFO_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
					},
				},
				{
					status: 200,
					delay: 50,
					body: USER_INFO_RESPONSE,
				},
			);

			server.post(
				{
					url: POST_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
						"x-restli-protocol-version": "2.0.0",
					},
					body: {
						author: `urn:li:person:${USER_INFO_RESPONSE.sub}`,
						lifecycleState: "PUBLISHED",
						specificContent: {
							"com.linkedin.ugc.ShareContent": {
								shareCommentary: {
									text,
								},
								shareMediaCategory: "NONE",
							},
						},
						visibility: {
							"com.linkedin.ugc.MemberNetworkVisibility":
								"PUBLIC",
						},
					},
				},
				{
					status: 200,
					body: CREATE_POST_RESPONSE,
					delay: 100,
				},
			);

			setTimeout(() => controller.abort(), 10);

			await assert.rejects(async () => {
				await strategy.post(text, { signal: controller.signal });
			}, /AbortError/);
		});
	});

	describe("getUrlFromResponse", function () {
		let strategy;
		const options = { accessToken: ACCESS_TOKEN };

		beforeEach(function () {
			strategy = new LinkedInStrategy(options);
		});

		it("should generate the correct URL from a response", function () {
			const response = {
				id: "urn:li:share:123456789",
			};

			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(
				url,
				"https://www.linkedin.com/feed/update/urn:li:share:123456789",
			);
		});

		it("should throw an error when the post ID is missing", function () {
			const response = {};

			assert.throws(() => {
				strategy.getUrlFromResponse(response);
			}, /Post ID not found in response/);
		});

		it("should throw an error when the response is null", function () {
			assert.throws(() => {
				strategy.getUrlFromResponse(null);
			}, /Post ID not found in response/);
		});
	});
});
