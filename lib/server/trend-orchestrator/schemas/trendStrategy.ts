import { z } from "zod"

export const TikTokLinkSchema = z.object({
	url: z.string(),
	trendContext: z.string(),
})

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
			.describe(
				"A specific currently trending TikTok track formatted as 'Song Title - Artist (version/remix if relevant)'. Not a descriptive sound texture.",
			),
	}),
	source_evidence: z.string(),
	sourceLinks: z.array(TikTokLinkSchema),
	cultural_context: z
		.string()
		.describe("Why does this specific sub-culture care about this?"),
})

export const TrendStrategySchema = z.object({
	strategicBrief: z.string(),
	contentIdeas: z.array(ContentIdeaSchema).length(3),
	tiktokLinks: z.array(TikTokLinkSchema).min(1),
	reasoning: z.string(),
	creativeAnomaly: z
		.string()
		.describe(
			"Something that feels completely wrong in this context but makes it go absolutely viral.",
		),
	subcultureMashup: z
		.string()
		.describe(
			"What two subcultures collide here (eg 'Opera-core meets Skate-punk').",
		),
	visualSignature: z
		.string()
		.describe(
			"A specific visual detail that recurs, such as 'everyone wears a silver mask' or 'everything is filmed through a plastic bag'.",
		),
})
