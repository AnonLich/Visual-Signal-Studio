import { exaAISearchClient } from "../exa"
import {
	ResearchTrendsOutputJsonSchema,
	ResearchTrendsToolInputSchema,
} from "./schemas"
import type { ResearchTrendsToolInput } from "./types"

const ONE_YEAR_IN_MS = 365 * 24 * 60 * 60 * 1000

function isWithinLastYear(isoDate: string) {
	const timestamp = new Date(isoDate).getTime()
	if (!Number.isFinite(timestamp)) return false
	return Date.now() - timestamp <= ONE_YEAR_IN_MS
}

export function createResearchTrendsTool() {
	return {
		description:
			"Search specifically for TikTok-native newsletters, Substack culture-reports, and niche fashion forums (like Highsnobiety, Hypebeast, or substacks like 'Blackbird Spyplane'). Avoid generic e-commerce blogs. Look for 'visual cues' and 'sound IDs'.",
		inputSchema: ResearchTrendsToolInputSchema,
		execute: async ({ searchQuery }: ResearchTrendsToolInput) => {
			const response = await exaAISearchClient.chat.completions.create({
				model: "exa",
				messages: [
					{
						role: "system",
						content:
							"Find 10-15 SPECIFIC viral TikTok aesthetics from the last 12 months only. Discard anything older than 365 days. Return JSON with 'trend_name', 'visual_vibe', 'audio_or_slang', 'source_url', 'observed_at_iso', and 'why_its_viral'. Field 'audio_or_slang' must be a specific currently trending TikTok song in this format: 'Song Title - Artist (version/remix if relevant)'. Avoid generic 'discover' pages.",
					},
					{ role: "user", content: searchQuery },
				],
				extra_body: {
					outputSchema: ResearchTrendsOutputJsonSchema,
					numResults: 15,
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any)

			const parsed = JSON.parse(
				response.choices[0]?.message?.content || '{"trends":[]}',
			)

			const trends: unknown[] = Array.isArray(parsed?.trends) ? parsed.trends : []
			const freshTrends = trends.filter(
				(trend: unknown) => {
					if (!trend || typeof trend !== "object") return false
					const observedAt = (trend as { observed_at_iso?: unknown }).observed_at_iso
					return (
						typeof observedAt === "string" && isWithinLastYear(observedAt)
					)
				},
			)

			return { trends: freshTrends }
		},
	}
}
