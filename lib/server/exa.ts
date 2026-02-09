import "server-only"
import { getRequiredEnv } from "@/lib/server/env"

type ExaSearchResult = {
	title?: string
	url?: string
	publishedDate?: string
	score?: number
	text?: string
	highlights?: string[]
}

type ExaSearchResponse = {
	requestId?: string
	autopromptString?: string
	resolvedSearchType?: string
	results?: ExaSearchResult[]
}

const VERY_LATEST_WINDOW_DAYS = 7

function isoDaysAgo(days: number): string {
	const now = Date.now()
	return new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
}

export async function researchTrends(
	query: string,
): Promise<ExaSearchResponse> {
	const apiKey = getRequiredEnv("EXA_SEARCH_API_KEY")

	const response = await fetch("https://api.exa.ai/search", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-api-key": apiKey,
		},
		body: JSON.stringify({
			query: query,
			type: "neural",
			numResults: 10,
			// --- DETTA ÄR NYCKELN ---
			includeDomains: [
				"tiktok.com",
				"instagram.com",
				"dexerto.com",
				"knowyourmeme.com",
				"passionfru.it",
				"theverge.com",
				"highsnobiety.com",
			],
			text: { maxCharacters: 1000 },
			highlights: {
				numSentences: 3,
				highlightsPerUrl: 2,
			},
		}),
	})

	if (!response.ok) {
		const details = await response
			.text()
			.catch(() => "Unknown Exa API error")
		throw new Error(
			`Exa trend research failed (${response.status}): ${details}`,
		)
	}

	return (await response.json()) as ExaSearchResponse
}
