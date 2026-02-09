import "server-only"
import { getRequiredEnv } from "@/lib/server/env"

import OpenAI from "openai"
// has to use openai client
export const exaAISearchClient = new OpenAI({
	baseURL: "https://api.exa.ai",

	apiKey: getRequiredEnv("EXA_SEARCH_API_KEY"),
})

type TikTokVideoLink = {
	url: string
	trendContext: string
}

export async function searchTikTokVideoLinks(
	query: string,
): Promise<TikTokVideoLink[]> {
	const apiKey = getRequiredEnv("EXA_SEARCH_API_KEY")

	const response = await fetch("https://api.exa.ai/search", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-api-key": apiKey,
		},
		body: JSON.stringify({
			query: `${query} site:tiktok.com video`,
			type: "neural",
			numResults: 10,
			includeDomains: ["tiktok.com"],
			text: true,
		}),
	})

	if (!response.ok) {
		return []
	}

	const data = (await response.json()) as {
		results?: Array<{ url?: string; title?: string }>
	}

	return (data.results ?? [])
		.map((item) => item.url)
		.filter(
			(url): url is string =>
				typeof url === "string" &&
				/tiktok\.com/i.test(url) &&
				/\/video\/\d+/i.test(url),
		)
		.map((url) => ({
			url,
			trendContext: `TikTok link found for query: ${query}`,
		}))
}
