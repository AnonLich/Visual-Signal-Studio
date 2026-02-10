import { exaAISearchClient } from "../exa"
import {
	ResearchTrendsOutputJsonSchema,
	ResearchTrendsToolInputSchema,
} from "./schemas"
import type { ResearchTrendsToolInput } from "./types"

export function createResearchTrendsTool() {
	return {
		description:
			"Search Exa for high-signal cultural trends and viral formats.",
		inputSchema: ResearchTrendsToolInputSchema,
		execute: async ({ searchQuery }: ResearchTrendsToolInput) => {
			const response = await exaAISearchClient.chat.completions.create({
				model: "exa",
				messages: [
					{
						role: "system",
						content:
							"Find 3-5 SPECIFIC viral TikTok aesthetics or sounds for 2026. Return JSON with 'trend_name', 'visual_vibe', 'audio_or_slang', and 'source_url'. Avoid generic 'discover' pages.",
					},
					{ role: "user", content: searchQuery },
				],
				extra_body: {
					outputSchema: ResearchTrendsOutputJsonSchema,
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any)

			return JSON.parse(
				response.choices[0]?.message?.content || '{"trends":[]}',
			)
		},
	}
}
