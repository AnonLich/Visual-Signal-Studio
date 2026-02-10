import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { getRequiredEnv } from "@/lib/server/env"
import { exaAISearchClient } from "../exa"
import {
	ResearchTrendsOutputJsonSchema,
	ResearchTrendsToolInputSchema,
} from "./schemas"
import {
	buildQueryVariants,
	dedupeSources,
	normalizeTrendItem,
	ONE_YEAR_IN_MS,
	searchRecentSources,
	TrendItem,
	TrendSynthesisSchema,
} from "./researchTrends.helpers"
import type { ResearchTrendsToolInput } from "./types"

export function createResearchTrendsTool() {
	return {
		description:
			"Search specifically for TikTok-native newsletters, Substack culture-reports, and niche fashion forums (like Highsnobiety, Hypebeast, or substacks like 'Blackbird Spyplane'). Avoid generic e-commerce blogs. Look for 'visual cues' and 'sound IDs'.",
		inputSchema: ResearchTrendsToolInputSchema,
		execute: async ({ searchQuery }: ResearchTrendsToolInput) => {
			const cutoffIso = new Date(Date.now() - ONE_YEAR_IN_MS).toISOString()
			const apiKey = getRequiredEnv("EXA_SEARCH_API_KEY")
			const queryVariants = buildQueryVariants(searchQuery)

			const sourceResults = await Promise.allSettled(
				queryVariants.map((query) =>
					searchRecentSources({
						query,
						cutoffIso,
						apiKey,
					}),
				),
			)

			const sourcePool = dedupeSources(
				sourceResults.flatMap((result) =>
					result.status === "fulfilled" ? result.value : [],
				),
			)

			if (sourcePool.length === 0) {
				return { trends: [] }
			}

			const allowedUrls = new Set(sourcePool.map((source) => source.url))

			try {
				const synthesis = await generateObject({
					model: openai.chat("gpt-4o-mini"),
					schema: TrendSynthesisSchema,
					system:
						"Convert the provided fresh sources into concrete TikTok trend signals. Use ONLY the provided source URLs. Keep each observed_at_iso within the last 12 months. audio_or_slang must be a specific currently trending TikTok song in this format: 'Song Title - Artist (version/remix if relevant)'.",
					prompt: `
Today: ${new Date().toISOString()}
Recency cutoff (inclusive): ${cutoffIso}
Search intent: ${searchQuery}

Source pool:
${JSON.stringify(sourcePool)}
`,
				})

				const normalizedTrends = synthesis.object.trends
					.map((item) => normalizeTrendItem(item, allowedUrls))
					.filter((item): item is TrendItem => Boolean(item))

				const uniqueTrends = Array.from(
					new Map(
						normalizedTrends.map((item) => [
							`${item.source_url}|${item.trend_name.toLowerCase()}`,
							item,
						]),
					).values(),
				)

				if (uniqueTrends.length > 0) {
					return { trends: uniqueTrends.slice(0, 15) }
				}
			} catch {
				// fall through to Exa structured fallback
			}

			const fallbackResponse = await exaAISearchClient.chat.completions.create({
				model: "exa",
				messages: [
					{
						role: "system",
						content:
							`Today is ${new Date().toISOString()}. Find only trends from the last 12 months (no older than 365 days). Return JSON with 'trend_name', 'visual_vibe', 'audio_or_slang', 'source_url', 'observed_at_iso', and 'why_its_viral'. Use only these URLs: ${Array.from(allowedUrls).join(", ")}.`,
					},
					{ role: "user", content: searchQuery },
				],
				extra_body: {
					outputSchema: ResearchTrendsOutputJsonSchema,
					numResults: 15,
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any)

			const fallbackParsed = JSON.parse(
				fallbackResponse.choices[0]?.message?.content || '{"trends":[]}',
			)

			const fallbackTrendItems: unknown[] = Array.isArray(fallbackParsed?.trends)
				? fallbackParsed.trends
				: []

			const fallbackTrends = fallbackTrendItems
				.map((trend: unknown) =>
					normalizeTrendItem(trend as TrendItem, allowedUrls),
				)
				.filter((item): item is TrendItem => Boolean(item))

			return { trends: fallbackTrends.slice(0, 15) }
		},
	}
}
