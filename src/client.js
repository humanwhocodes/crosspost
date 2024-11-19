/**
 * @fileoverview The client API.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Type Definitions
//-----------------------------------------------------------------------------

/**
 * @typedef {Object} ClientOptions
 * @property {Array<Strategy>} strategies An array of strategies to use.
 */

/**
 * @typedef {Object} Strategy
 * @property {string} name The name of the strategy.
 * @property {(message: string) => Promise<any>} post A function that posts a message.
 */

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Represents a client that can post messages using different strategies.
 */
export class Client {
   
    /**
     * The strategies to use.
     * @type {Array<Strategy>}
     */
    #strategies = [];

    /**
     * Creates a new instance.
     * @param {ClientOptions} options Options for the instance.
     * @throws {TypeError} When options are missing or invalid.
     */
    constructor(options) {
        this.#strategies = options.strategies;

        if (!Array.isArray(this.#strategies)) {
            throw new TypeError("strategies must be an array.");
        }

        if (!this.#strategies.length) {
            throw new TypeError("No strategies provided.");
        }
    }

    /**
     * Posts a message using all strategies.
     * @param {string} message The message to post.
     * @returns {Promise<Object>} A promise that resolves with an array of results.
     */
    async post(message) {
        const results = await Promise.allSettled(this.#strategies.map(strategy => strategy.post(message)));

        // find any failed results
        /** @type {Array<number>} */
        const failedIndices = [];
        const failed = /** @type {Array<PromiseRejectedResult>} */ (results.filter((result, i) => {
            if (result.status === "rejected") {
                failedIndices.push(i);
                return true;
            }

            return false;
        }));

        // if there are failed results, throw an error with the failing strategy names
        if (failed.length) {
            
            throw new AggregateError(
                failed.map(result => result.reason),
                `Failed to post to strategies: ${failedIndices.map(i => this.#strategies[i].name).join(", ")}`
            );
        }

        // otherwise return the response payloads keyed by strategy name
        return Object.fromEntries(results.map((result, i) => [this.#strategies[i].name, /** @type {PromiseFulfilledResult<Object>} */ (result).value]));
    }
}
