import { randomUUID } from "crypto"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
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

function resolveImageUrl(image: { data: string; imageUrl?: string }) {
	if (typeof image.imageUrl === "string" && image.imageUrl.trim().length > 0) {
		return image.imageUrl.trim()
	}

	return /^https?:\/\//i.test(image.data) ? image.data : null
}

function decodeImageData(image: { data: string }) {
	const base64Payload = image.data.startsWith("data:")
		? image.data.split(",")[1] ?? ""
		: image.data

	return Buffer.from(base64Payload, "base64")
}

function getRequiredEnv(name: string): string {
	const value = process.env[name]
	if (!value) {
		throw new Error(`Missing required env var: ${name}`)
	}

	return value
}

async function uploadImageToS3(image: {
	data: string
	mediaType: string
	imageUrl?: string
}) {
	const existingUrl = resolveImageUrl(image)
	if (existingUrl) {
		return existingUrl
	}

	const region = getRequiredEnv("AWS_REGION")
	const bucket = getRequiredEnv("S3_BUCKET")
	const accessKeyId = getRequiredEnv("AWS_ACCESS_KEY_ID")
	const secretAccessKey = getRequiredEnv("AWS_SECRET_ACCESS_KEY")

	const s3 = new S3Client({
		region,
		credentials: {
			accessKeyId,
			secretAccessKey,
		},
	})

	const extension = image.mediaType.split("/")[1] ?? "bin"
	const key = `uploads/${randomUUID()}.${extension}`
	const body = decodeImageData(image)

	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: image.mediaType,
		}),
	)

	const encodedKey = key
		.split("/")
		.map((part) => encodeURIComponent(part))
		.join("/")

	return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`
}

export async function POST(req: Request) {
	const { prompt, images } = (await req.json()) as {
		prompt?: string
		images?: Array<{ data: string; mediaType: string; imageUrl?: string }>
	}

	if (!images || images.length === 0) {
		return new Response("No images provided", { status: 400 })
	}

	const rowsToInsert: Array<{ embeddedImage: number[]; imageUrl: string | null }> = []

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
		const imageUrl = await uploadImageToS3(image)
		rowsToInsert.push({ embeddedImage: embedding, imageUrl })
	}

	const saved = await db.insert(imagesTable).values(rowsToInsert).returning({
		id: imagesTable.id,
		imageUrl: imagesTable.imageUrl,
	})

	return Response.json({ count: saved.length, items: saved }, { status: 201 })
}
