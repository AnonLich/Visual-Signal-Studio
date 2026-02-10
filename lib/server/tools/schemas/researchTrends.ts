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
					},
					source_url: {
						type: "string",
					},
					why_its_viral: {
						type: "string",
					},
				},
				required: ["trend_name", "source_url", "visual_vibe"],
			},
		},
	},
	required: ["trends"],
} as const
