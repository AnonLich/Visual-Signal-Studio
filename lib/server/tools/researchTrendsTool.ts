import { exaAISearchClient } from "../exa"
import {
	ResearchTrendsOutputJsonSchema,
	ResearchTrendsToolInputSchema,
} from "./schemas"
import type { ResearchTrendsToolInput } from "./types"

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
							"Find 10-15 SPECIFIC viral TikTok aesthetics or sounds for 2026. Return JSON with 'trend_name', 'visual_vibe', 'audio_or_slang', and 'source_url'. Avoid generic 'discover' pages.",
					},
					{ role: "user", content: searchQuery },
				],
				extra_body: {
					outputSchema: ResearchTrendsOutputJsonSchema,
					numResults: 15,
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any)

			console.log(
				JSON.parse(
					response.choices[0]?.message?.content || '{"trends":[]}',
				),
			)

			return JSON.parse(
				response.choices[0]?.message?.content || '{"trends":[]}',
			)
		},
	}
}
