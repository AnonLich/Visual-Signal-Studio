import "server-only"
import { openai } from "@ai-sdk/openai"
import { embed, generateObject } from "ai"
import { z } from "zod"

const ImageAnalysisSchema = z.object({
	title: z.string(),
	shortDescription: z.string(),
	aestheticStyle: z
		.string()
		.describe("T.ex. Minimalist, Maximalist, Y2K, Industrial, Cinematic"),
	colorPalette: z.array(z.string()),
	// "emotionalVibe" är bra, men "brandArchetype" hjälper Agenten att förstå personligheten
	brandArchetype: z
		.string()
		.describe(
			"T.ex. The Rebel, The Caregiver, The Explorer, The Luxury Minimalist",
		),
	visualKeywords: z
		.array(z.string())
		.describe(
			"5-10 taggar som beskriver stilen, t.ex. ['matte', 'grainy', 'symmetrical']",
		),
	targetAudience: z.string(),
	marketSegment: z.enum(["Budget", "Mid-range", "Premium", "Luxury"]),
	text: z.string().describe("If any text is showing on the image"),
})

export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>

export function analysisToStrategicBrief(analysis: ImageAnalysis): string {
	return [
		`CORE AESTHETIC: ${analysis.aestheticStyle}`,
		`BRAND PERSONALITY: ${analysis.brandArchetype}`,
		`VISUAL LANGUAGE: ${analysis.shortDescription} with a ${analysis.colorPalette.join(", ")} palette.`,
		`STYLE MARKERS: ${analysis.visualKeywords.join(", ")}`,
		`MARKET POSITION: ${analysis.marketSegment} targeting ${analysis.targetAudience}`,
		`TEXT / BRAND TEXT: ${analysis.text}`,
	].join(" | ") // Vi använder pipe (|) för att separera segment, det fungerar ofta bättre för neural sökning
}

export async function analyzeImage(params: {
	prompt?: string
	image: string
	mediaType: string
}) {
	const { prompt, image, mediaType } = params

	const result = await generateObject({
		model: openai.chat("gpt-4.1-mini"),
		schema: ImageAnalysisSchema,
		schemaName: "ImageStyleAnalysis",
		schemaDescription:
			"Extract structured creative direction from the provided image.",
		messages: [
			{
				role: "user",
				content: [
					{
						type: "text",
						text:
							prompt ??
							"Analyze the image and fill out the fields in the schema as precisely as possible.",
					},
					{
						type: "image",
						image,
						mediaType,
					},
				],
			},
		],
	})

	return result.object
}

export async function embedImageAnalysis(analysis: ImageAnalysis) {
	const embeddingResult = await embed({
		model: openai.embedding("text-embedding-3-small"),
		value: analysisToStrategicBrief(analysis),
	})

	return embeddingResult.embedding
}
