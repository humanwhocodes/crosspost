/**
 * @fileoverview Tests for the FacebookStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { FacebookStrategy } from "../../src/strategies/facebook.js";
import { FetchMocker, MockServer } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const ACCESS_TOKEN = "test-token-123";
const POST_RESPONSE = {
    id: "12345_67890"
};

const server = new MockServer("https://graph.facebook.com");
const fetchMocker = new FetchMocker({
    servers: [server]
});

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("FacebookStrategy", () => {
    describe("constructor", () => {
        it("should throw an error when access token is missing", () => {
            assert.throws(
                () => new FacebookStrategy({}),
                TypeError,
                "Missing access token."
            );
        });

        it("should create an instance when all required options are provided", () => {
            const strategy = new FacebookStrategy({ accessToken: ACCESS_TOKEN });
            assert.strictEqual(strategy.name, "facebook");
        });
    });

    describe("post", () => {
        beforeEach(() => {
            fetchMocker.mockGlobal();
        });

        afterEach(() => {
            fetchMocker.unmockGlobal();
            server.clear();
        });

        it("should throw an error when message is missing", async () => {
            const strategy = new FacebookStrategy({ accessToken: ACCESS_TOKEN });
            await assert.rejects(
                async () => strategy.post(),
                TypeError,
                "Missing message to post."
            );
        });

        it("should successfully post to personal feed", async () => {
            const message = "Hello Facebook!";
            const strategy = new FacebookStrategy({ accessToken: ACCESS_TOKEN });

            server.post({
                url: "/v18.0/me/feed",
                body: {
                    message,
                    access_token: ACCESS_TOKEN
                }
            }, {
                status: 200,
                body: POST_RESPONSE
            });

            const result = await strategy.post(message);
            assert.deepStrictEqual(result, POST_RESPONSE);
        });

        it("should successfully post to page feed", async () => {
            const message = "Hello Facebook!";
            const pageId = "123456789";
            const strategy = new FacebookStrategy({ 
                accessToken: ACCESS_TOKEN,
                pageId
            });

            server.post({
                url: `/v18.0/${pageId}/feed`,
                body: {
                    message,
                    access_token: ACCESS_TOKEN
                }
            }, {
                status: 200,
                body: POST_RESPONSE
            });

            const result = await strategy.post(message);
            assert.deepStrictEqual(result, POST_RESPONSE);
        });
    });
});
