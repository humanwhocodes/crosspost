/**
 * @fileoverview Tests for insertPost function logic in OrgSocialStrategy
 * @author Andros Fenollosa
 */

import assert from "node:assert";

/**
 * Simplified version of insertPost function for testing
 * @param {string} content The current file content.
 * @param {string} postEntry The post entry to insert.
 * @returns {string} The updated file content.
 */
function insertPost(content, postEntry) {
	// Find the "* Posts" section
	const postsRegex = /^(\* Posts)$/m;
	const match = content.match(postsRegex);

	if (match && match.index !== undefined) {
		// Get everything after "* Posts"
		const afterPosts = content.substring(match.index + match[0].length);

		// Remove ONLY empty ** at the very beginning (template marker)
		const cleanAfterPosts = afterPosts.replace(/^\n\*\*\s*$/, "");

		// Check if there are already posts with content
		const hasExistingPosts = /\*\*\s*\n:PROPERTIES:/m.test(cleanAfterPosts);

		// Reconstruct content
		const beforePosts = content.substring(0, match.index + match[0].length);

		if (hasExistingPosts) {
			// Already has posts, add blank line before new post
			return beforePosts + cleanAfterPosts + "\n" + postEntry;
		} else {
			// First post, no blank line
			return beforePosts + "\n" + postEntry;
		}
	}

	// If "* Posts" doesn't exist, add it at the end with the post (no blank line)
	return content + "\n* Posts\n" + postEntry;
}

describe("insertPost function", () => {
	it("should append post at the end when Posts section exists", () => {
		const existingContent = `#+TITLE: Test User
#+NICK: testuser

* Posts
**
:PROPERTIES:
:ID: 2025-01-01T12:00:00+0100
:END:
First post content
`;

		const newPost = `**
:PROPERTIES:
:ID: 2025-01-02T14:30:00+0100
:END:
Second post content
`;

		const result = insertPost(existingContent, newPost);

		// Verify both posts are present
		assert.ok(
			result.includes("First post content"),
			"Should contain first post",
		);
		assert.ok(
			result.includes("Second post content"),
			"Should contain second post",
		);

		// Verify order: first post should come before second post
		const firstPostIndex = result.indexOf("First post content");
		const secondPostIndex = result.indexOf("Second post content");
		assert.ok(
			firstPostIndex < secondPostIndex,
			"Second post should be after first post",
		);

		// Verify the new post is at the end of the file
		const trimmedResult = result.trim();
		assert.ok(
			trimmedResult.endsWith("Second post content"),
			"New post should be at the end",
		);
	});

	it("should create Posts section and add post when section doesn't exist", () => {
		const existingContent = `#+TITLE: Test User
#+NICK: testuser
`;

		const newPost = `**
:PROPERTIES:
:ID: 2025-01-01T12:00:00+0100
:END:
First post content
`;

		const result = insertPost(existingContent, newPost);

		// Verify Posts section was created
		assert.ok(result.includes("* Posts"), "Should create Posts section");

		// Verify post was added
		assert.ok(
			result.includes("First post content"),
			"Should contain the post",
		);

		// Verify order: Posts section comes before the post
		const postsIndex = result.indexOf("* Posts");
		const postIndex = result.indexOf("First post content");
		assert.ok(
			postsIndex < postIndex,
			"Post should come after Posts section",
		);

		// Verify no blank line between "* Posts" and first "**"
		assert.ok(
			result.includes("* Posts\n**"),
			"Should have no blank line between Posts and first post",
		);
	});

	it("should remove empty post markers from template", () => {
		const templateContent = `#+TITLE: Test User
#+NICK: testuser

* Posts
**
`;

		const newPost = `**
:PROPERTIES:
:ID: 2025-01-01T12:00:00+0100
:END:
First real post
`;

		const result = insertPost(templateContent, newPost);

		// Verify the empty ** was removed
		const postsMatch = result.match(/\* Posts\n\*\*/g);
		assert.strictEqual(
			postsMatch ? postsMatch.length : 0,
			1,
			"Should only have one ** marker (the real post)",
		);

		// Verify the post content is there
		assert.ok(
			result.includes("First real post"),
			"Should contain the post",
		);

		// Verify correct format: * Posts\n**\n:PROPERTIES:
		assert.ok(
			result.includes("* Posts\n**\n:PROPERTIES:"),
			"Should have correct format without empty post",
		);
	});

	it("should append multiple posts in order with correct spacing", () => {
		let content = `#+TITLE: Test User
#+NICK: testuser

* Posts
`;

		const post1 = `**
:PROPERTIES:
:ID: 2025-01-01T12:00:00+0100
:END:
Post 1
`;

		const post2 = `**
:PROPERTIES:
:ID: 2025-01-02T12:00:00+0100
:END:
Post 2
`;

		const post3 = `**
:PROPERTIES:
:ID: 2025-01-03T12:00:00+0100
:END:
Post 3
`;

		// Add posts one by one
		content = insertPost(content, post1);
		content = insertPost(content, post2);
		content = insertPost(content, post3);

		// Verify all posts are present
		assert.ok(content.includes("Post 1"), "Should contain post 1");
		assert.ok(content.includes("Post 2"), "Should contain post 2");
		assert.ok(content.includes("Post 3"), "Should contain post 3");

		// Verify order
		const post1Index = content.indexOf("Post 1");
		const post2Index = content.indexOf("Post 2");
		const post3Index = content.indexOf("Post 3");

		assert.ok(post1Index < post2Index, "Post 2 should be after Post 1");
		assert.ok(post2Index < post3Index, "Post 3 should be after Post 2");

		// Verify first post has no blank line before it
		assert.ok(
			content.includes("* Posts\n**"),
			"First post should have no blank line before it",
		);

		// Verify subsequent posts have blank line before them
		assert.ok(
			content.includes("Post 1\n\n**"),
			"Second post should have blank line before it",
		);
	});
});
