import { z } from "zod"

export const ResearchTrendsToolInputSchema = z.object({
	searchQuery: z.string(),
})

export const ResearchTrendsOutputJsonSchema = {
	type: "object",
	properties: {
		trends: {
			type: "array",
			items: {
				type: "object",
				properties: {
					trend_name: {
						type: "string",
					},
					visual_vibe: {
						type: "string",
						description: "Lighting, framing, and editing style",
					},
					audio_or_slang: {
						type: "string",
						description:
							"Specific currently trending TikTok song in format 'Song Title - Artist (version/remix if relevant)'",
					},
					source_url: {
						type: "string",
					},
					observed_at_iso: {
						type: "string",
						description:
							"ISO 8601 date for when this trend signal was observed or published (must be within the last 12 months).",
					},
					why_its_viral: {
						type: "string",
					},
				},
				required: [
					"trend_name",
					"source_url",
					"visual_vibe",
					"audio_or_slang",
					"observed_at_iso",
					"why_its_viral",
				],
			},
		},
	},
	required: ["trends"],
} as const
