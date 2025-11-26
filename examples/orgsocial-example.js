/**
 * @fileoverview Example usage of OrgSocialStrategy
 * @author Andros Fenollosa
 */

/* global setTimeout, AbortController */

import { OrgSocialStrategy, Client } from "@humanwhocodes/crosspost";

// Initialize the Org Social strategy with your vfile and public URL
// You get these from signing up at an Org Social Host instance
const orgSocial = new OrgSocialStrategy({
	// The vfile URL you received during signup (contains authentication token)
	vfile: "http://host.org-social.org/vfile?token=YOUR_TOKEN&ts=TIMESTAMP&sig=SIGNATURE",

	// Your public social.org URL
	publicUrl: "http://host.org-social.org/your-nick/social.org",

	// Optional: Custom Org Social Host instance (defaults to "host.org-social.org")
	host: "host.org-social.org",
});

// Example 1: Post a simple message
export async function postSimpleMessage() {
	try {
		const response = await orgSocial.post("Hello from Org Social! 🌍");
		console.log("Post successful!");
		console.log("Public URL:", response.data["public-url"]);
	} catch (error) {
		console.error("Failed to post:", error.message);
	}
}

// Example 2: Post with multiple lines
export async function postMultilineMessage() {
	try {
		const message = `This is a multiline post with rich content.

I can include:
- Lists with multiple items
- *Bold text* and /italic text/
- Code snippets: ~print("hello")~
- Links: [[https://example.com][Example website]]

And much more!`;

		const response = await orgSocial.post(message);
		console.log("Multiline post successful!");
		console.log("Public URL:", response.data["public-url"]);
	} catch (error) {
		console.error("Failed to post:", error.message);
	}
}

// Example 3: Use with the Client to post to multiple services
export async function postToMultipleServices() {
	// You can combine Org Social with other strategies
	const client = new Client({
		strategies: [
			orgSocial,
			// Add other strategies here (Twitter, Mastodon, etc.)
		],
	});

	try {
		const results = await client.post("Hello from all my social networks!");

		results.forEach(result => {
			if (result.ok) {
				console.log(
					`✓ ${result.name}: ${result.url || "Posted successfully"}`,
				);
			} else {
				console.error(`✗ ${result.name}: ${result.reason.message}`);
			}
		});
	} catch (error) {
		console.error("Failed to post:", error.message);
	}
}

// Example 4: Handle abort signals
export async function postWithAbortSignal() {
	const controller = new AbortController();

	// Cancel the post after 5 seconds
	setTimeout(() => controller.abort(), 5000);

	try {
		await orgSocial.post("This post might be cancelled...", {
			signal: controller.signal,
		});
		console.log("Post successful!");
	} catch (error) {
		if (error.name === "AbortError") {
			console.log("Post was cancelled");
		} else {
			console.error("Failed to post:", error.message);
		}
	}
}

// Note: Images are not supported in Org Social text posts
// If you need to share images, include links to them in your message:
export async function postWithImageLinks() {
	try {
		const message = `Check out this beautiful sunset!

[[https://example.com/sunset.jpg][Beautiful Sunset]]`;

		await orgSocial.post(message);
		console.log("Post with image link successful!");
	} catch (error) {
		console.error("Failed to post:", error.message);
	}
}

// Important notes about Org Social:
// - Posts are appended at the END of your social.org file, after the last post
// - No character limit - write as much as you want!
// - Supports full Org Mode syntax: bold, italic, code blocks, tables, etc.
// - Images not supported directly, but you can include image links

// Run examples
// Uncomment the function you want to test:
// postSimpleMessage();
// postMultilineMessage();
// postToMultipleServices();
// postWithAbortSignal();
// postWithImageLinks();
