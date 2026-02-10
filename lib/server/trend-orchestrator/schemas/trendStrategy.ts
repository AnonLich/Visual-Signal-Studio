import { z } from "zod"

export const ContentIdeaSchema = z.object({
	title: z.string(),
	tiktok_script: z.object({
		hook: z.string().describe("The first 1.5 seconds that stop the scroll"),
		visual_direction: z
			.string()
			.describe(
				"Camera angle, lighting type (e.g. high-contrast), and editing pace",
			),
		audio_spec: z
			.string()
			.describe("The specific viral sound or ASMR trigger to use"),
	}),
	source_evidence: z.string(),
	cultural_context: z
		.string()
		.describe("Why does this specific sub-culture care about this?"),
})

export const TikTokLinkSchema = z.object({
	url: z.string(),
	trendContext: z.string(),
})

export const TrendStrategySchema = z.object({
	strategicBrief: z.string(),
	contentIdeas: z.array(ContentIdeaSchema).length(3),
	tiktokLinks: z.array(TikTokLinkSchema).min(1),
	reasoning: z.string(),
})
