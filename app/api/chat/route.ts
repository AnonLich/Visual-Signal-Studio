import { openai } from "@ai-sdk/openai"
import { embed, generateObject } from "ai"
import { z } from "zod"
import { db } from "@/db"
import { images as imagesTable } from "@/db/schema"

export const maxDuration = 30

const imageAnalysisSchema = z.object({
	title: z.string().nullable(),
	shortDescription: z.string(),
	lightning: z.string(),
	colorPalette: z.string(),
	cameraAngle: z.string(),
	emotionalVibe: z.string(),
	targetAudience: z.string(),
})

type ImageAnalysis = z.infer<typeof imageAnalysisSchema>

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

async function embedImage(analysis: ImageAnalysis) {
	const embeddingResult = await embed({
		model: openai.embedding("text-embedding-3-small"),
		value: analysisToEmbeddingInput(analysis),
	})

	return embeddingResult.embedding
}

function normalizeImageInput(image: { data: string; mediaType: string }) {
	const isAlreadyDataUrl = image.data.startsWith("data:")
	const isUrl = /^https?:\/\//i.test(image.data)

	return isAlreadyDataUrl || isUrl
		? image.data
		: `data:${image.mediaType};base64,${image.data}`
}

export async function POST(req: Request) {
	const { prompt, images } = (await req.json()) as {
		prompt?: string
		images?: Array<{ data: string; mediaType: string }>
	}

	if (!images || images.length === 0) {
		return new Response("No images provided", { status: 400 })
	}

	const rowsToInsert: Array<{ embeddedImage: string }> = []

	for (const image of images) {
		const imageValue = normalizeImageInput(image)

		const result = await generateObject({
			model: openai("gpt-4.1-mini"),
			schema: imageAnalysisSchema,
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
							image: imageValue,
							mediaType: image.mediaType,
						},
					],
				},
			],
		})

		const embedding = await embedImage(result.object)
		rowsToInsert.push({ embeddedImage: JSON.stringify(embedding) })
	}

	const saved = await db.insert(imagesTable).values(rowsToInsert).returning({
		id: imagesTable.id,
		embeddedImage: imagesTable.embeddedImage,
	})

	return Response.json({ count: saved.length, items: saved }, { status: 201 })
}
