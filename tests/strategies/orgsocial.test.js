/**
 * @fileoverview Tests for the OrgSocialStrategy class.
 * @author Andros Fenollosa
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { OrgSocialStrategy } from "../../src/strategies/orgsocial.js";
import assert from "node:assert";
import { FetchMocker, MockServer } from "mentoss";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const SAMPLE_SOCIAL_ORG = `#+TITLE: Test User
#+NICK: testuser

* Posts
`;

const SAMPLE_VFILE = "http://localhost/vfile?token=test&ts=123&sig=abc";
const SAMPLE_PUBLIC_URL = "http://localhost/testuser/social.org";

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("OrgSocialStrategy", () => {
	describe("constructor", () => {
		it("should throw an error if vfile is missing", () => {
			assert.throws(
				() => new OrgSocialStrategy({ publicUrl: SAMPLE_PUBLIC_URL }),
				TypeError,
				"Missing vfile.",
			);
		});

		it("should throw an error if publicUrl is missing", () => {
			assert.throws(
				() => new OrgSocialStrategy({ vfile: SAMPLE_VFILE }),
				TypeError,
				"Missing publicUrl.",
			);
		});

		it("should create an instance if both vfile and publicUrl are provided", () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			assert(instance instanceof OrgSocialStrategy);
		});

		it("should create an instance with correct id and name", () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			assert.strictEqual(instance.id, "orgsocial");
			assert.strictEqual(instance.name, "Org Social");
		});

		it("should use default host if not provided", () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			assert.ok(instance);
		});

		it("should use custom host if provided", () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
				host: "custom.host.org",
			};
			const instance = new OrgSocialStrategy(options);
			assert.ok(instance);
		});
	});

	describe("calculateMessageLength", () => {
		it("should calculate message length correctly for ASCII text", () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const message = "Hello, Org Social!";
			// "Hello, Org Social!" = 18 characters
			assert.strictEqual(instance.calculateMessageLength(message), 18);
		});

		it("should calculate message length correctly for Unicode text", () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const message = "Hello 世界! 🌍";
			assert.strictEqual(instance.calculateMessageLength(message), 11);
		});

		it("should calculate message length correctly for emojis", () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const message = "🚀🌟✨";
			assert.strictEqual(instance.calculateMessageLength(message), 3);
		});
	});

	describe("post", () => {
		const server = new MockServer("https://host.org-social.org");
		const publicServer = new MockServer("http://localhost");
		const fetchMocker = new FetchMocker({
			servers: [server, publicServer],
		});

		beforeEach(() => {
			fetchMocker.mockGlobal(fetchMocker.fetch);
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
			publicServer.clear();
		});

		it("should throw an error if message is missing", async () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			await assert.rejects(instance.post(), {
				name: "TypeError",
				message: "Missing message to post.",
			});
		});

		it("should throw an error if images are provided", async () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const message = "Hello, Org Social!";
			const images = [
				{
					data: new Uint8Array([137, 80, 78, 71]),
					alt: "Test image",
				},
			];

			await assert.rejects(instance.post(message, { images }), {
				name: "Error",
				message:
					"Images are not supported in Org Social posts. Consider adding image links in the message text.",
			});
		});

		it("should download, update, and upload social.org file", async () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const message = "Hello, Org Social!";

			// Mock the public URL download
			publicServer.get(
				{
					url: "/testuser/social.org",
				},
				{
					status: 200,
					headers: {
						"content-type": "text/plain; charset=utf-8",
					},
					body: SAMPLE_SOCIAL_ORG,
				},
			);

			// Mock the upload
			server.post(
				{
					url: "/upload",
					request: {
						body: {
							vfile: SAMPLE_VFILE,
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: {
						type: "Success",
						errors: [],
						data: {
							message: "File uploaded successfully",
							"public-url": SAMPLE_PUBLIC_URL,
						},
					},
				},
			);

			const result = await instance.post(message);
			assert.strictEqual(result.type, "Success");
			assert.strictEqual(result.data["public-url"], SAMPLE_PUBLIC_URL);
		});

		it("should append posts at the end of the file", async () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const message = "Second post!";

			const existingContent = `#+TITLE: Test User
#+NICK: testuser

* Posts
**
:PROPERTIES:
:ID: 2025-01-01T12:00:00+0100
:END:

First post content
`;

			// Mock the public URL download with existing post
			publicServer.get(
				{
					url: "/testuser/social.org",
				},
				{
					status: 200,
					headers: {
						"content-type": "text/plain; charset=utf-8",
					},
					body: existingContent,
				},
			);

			// Mock the upload
			server.post(
				{
					url: "/upload",
					request: {
						body: {
							vfile: SAMPLE_VFILE,
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: {
						type: "Success",
						errors: [],
						data: {
							message: "File uploaded successfully",
							"public-url": SAMPLE_PUBLIC_URL,
						},
					},
				},
			);

			const result = await instance.post(message);
			assert.strictEqual(result.type, "Success");
		});

		it("should create a minimal template if file doesn't exist (404)", async () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const message = "First post!";

			// Mock 404 response for public URL download
			publicServer.get(
				{
					url: "/testuser/social.org",
				},
				{
					status: 404,
				},
			);

			// Mock the upload
			server.post(
				{
					url: "/upload",
					request: {
						body: {
							vfile: SAMPLE_VFILE,
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: {
						type: "Success",
						errors: [],
						data: {
							message: "File uploaded successfully",
							"public-url": SAMPLE_PUBLIC_URL,
						},
					},
				},
			);

			const result = await instance.post(message);
			assert.strictEqual(result.type, "Success");
		});

		it("should handle download errors", async () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const message = "Hello, Org Social!";

			// Mock error response for public URL download
			publicServer.get(
				{
					url: "/testuser/social.org",
				},
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
					body: {
						type: "Error",
						errors: ["Unauthorized"],
					},
				},
			);

			await assert.rejects(
				instance.post(message),
				/Failed to download social\.org/,
			);
		});

		it("should handle upload errors", async () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const message = "Hello, Org Social!";

			// Mock successful public URL download
			publicServer.get(
				{
					url: "/testuser/social.org",
				},
				{
					status: 200,
					headers: {
						"content-type": "text/plain; charset=utf-8",
					},
					body: SAMPLE_SOCIAL_ORG,
				},
			);

			// Mock error response for upload
			server.post(
				{
					url: "/upload",
					request: {
						body: {
							vfile: SAMPLE_VFILE,
						},
					},
				},
				{
					status: 400,
					headers: {
						"content-type": "application/json",
					},
					body: {
						type: "Error",
						errors: ["Invalid file format"],
					},
				},
			);

			await assert.rejects(
				instance.post(message),
				/Failed to upload social\.org/,
			);
		});
	});

	describe("getUrlFromResponse", () => {
		it("should extract public URL from response", () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const response = {
				type: "Success",
				errors: [],
				data: {
					message: "File uploaded successfully",
					"public-url": SAMPLE_PUBLIC_URL,
				},
			};

			const url = instance.getUrlFromResponse(response);
			assert.strictEqual(url, SAMPLE_PUBLIC_URL);
		});

		it("should throw an error if public URL is not in response", () => {
			const options = {
				vfile: SAMPLE_VFILE,
				publicUrl: SAMPLE_PUBLIC_URL,
			};
			const instance = new OrgSocialStrategy(options);
			const response = {
				type: "Success",
				errors: [],
				data: {},
			};

			assert.throws(
				() => instance.getUrlFromResponse(response),
				/Public URL not found in response/,
			);
		});
	});
});
