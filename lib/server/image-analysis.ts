import "server-only"
import { openai } from "@ai-sdk/openai"
import { embed, generateObject } from "ai"
import { z } from "zod"

const imageAnalysisSchema = z.object({
	title: z.string().nullable(),
	shortDescription: z.string(),
	lightning: z.string(),
	colorPalette: z.string(),
	cameraAngle: z.string(),
	emotionalVibe: z.string(),
	targetAudience: z.string(),
})

export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>

function analysisToEmbeddingInput(analysis: ImageAnalysis): string {
	return [
		`title: ${analysis.title ?? ""}`,
		`shortDescription: ${analysis.shortDescription}`,
		`lightning: ${analysis.lightning}`,
		`colorPalette: ${analysis.colorPalette}`,
		`cameraAngle: ${analysis.cameraAngle}`,
		`emotionalVibe: ${analysis.emotionalVibe}`,
		`targetAudience: ${analysis.targetAudience}`,
	].join("\n")
}

export async function analyzeImage(params: {
	prompt?: string
	image: string
	mediaType: string
}) {
	const { prompt, image, mediaType } = params

	const result = await generateObject({
		model: openai("gpt-4.1-mini"),
		schema: imageAnalysisSchema,
		schemaName: "ImageStyleAnalysis",
		schemaDescription: "Extract structured creative direction from the provided image.",
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
		value: analysisToEmbeddingInput(analysis),
	})

	return embeddingResult.embedding
}
