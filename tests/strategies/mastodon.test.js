/**
 * @fileoverview Tests for the MastodonStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import sinon from "sinon";
import { MastodonStrategy } from "../../src/strategies/mastodon.js";
import assert from "node:assert";

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("MastodonStrategy", () => {
    let fetchStub;

    beforeEach(() => {
        fetchStub = sinon.stub(globalThis, "fetch");
    });

    afterEach(() => {
        fetchStub.restore();
    });

    describe("constructor", () => {
        it("should throw an error if accessToken is missing", () => {
            assert.throws(() => new MastodonStrategy({ host: "mastodon.social" }), TypeError, "Missing Mastodon access token.");
        });

        it("should throw an error if host is missing", () => {
            assert.throws(() => new MastodonStrategy({ accessToken: "token" }), TypeError, "Missing Mastodon host.");
        });

        it("should create an instance if both accessToken and host are provided", () => {
            const options = { accessToken: "token", host: "mastodon.social" };
            const instance = new MastodonStrategy(options);
            assert(instance instanceof MastodonStrategy);
        });
    });

    describe("post", () => {
        it("should throw an error if message is missing", async () => {
            const options = { accessToken: "token", host: "mastodon.social" };
            const instance = new MastodonStrategy(options);
            await assert.rejects(instance.post(), {
                name: "Error",
                message: "Missing message to toot."
            });
        });

        it("should make a POST request to the correct URL", async () => {
            const options = { accessToken: "token", host: "mastodon.social" };
            const instance = new MastodonStrategy(options);
            const message = "Hello, Mastodon!";
            const response = { json: sinon.stub().resolves({ id: "12345" }) };
            fetchStub.resolves(response);

            const result = await instance.post(message);

            assert.strictEqual(fetchStub.calledOnce, true);
            assert.strictEqual(fetchStub.calledWith("https://mastodon.social/api/v1/statuses"), true);
            assert.strictEqual(fetchStub.args[0][1].method, "POST");
            assert.strictEqual(fetchStub.args[0][1].headers.Authorization, "Bearer token");
            assert.deepStrictEqual(result, { id: "12345" });
        });

        it("should handle fetch errors", async () => {
            const options = { accessToken: "token", host: "mastodon.social" };
            const instance = new MastodonStrategy(options);
            const message = "Hello, Mastodon!";
            fetchStub.rejects(new Error("Network error"));

            await assert.rejects(instance.post(message), {
                name: "Error",
                message: "Network error"
            });
        });
    });
});
