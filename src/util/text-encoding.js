/**
 * @fileoverview Text encoding utilities
 * @author Nicholas C. Zakas
 */

/**
 * Encodes a string into unicode escape sequences.
 * @param {string} text The text to encode.
 * @returns {string} The encoded text.
 */
export function encodeToUnicode(text) {
	// eslint-disable-next-line no-control-regex
	return text.replace(
		/[\ud800-\udbff][\udc00-\udfff]|[^\u0000-\u007f]/g,
		match => {
			if (match.length === 2) {
				// This is a surrogate pair
				const high = match.charCodeAt(0);
				const low = match.charCodeAt(1);
				return `\\u${high.toString(16)}\\u${low.toString(16)}`;
			}

			// Single unicode character
			const code = match.charCodeAt(0);
			return `\\u${code.toString(16).padStart(4, "0")}`;
		},
	);
}
