import { z } from "zod"
import { db } from "@/db"
import { images as imagesTable } from "@/db/schema"
import { analyzeImage, embedImageAnalysis } from "@/lib/server/image-analysis"
import {
	decodeImageData,
	extensionFromMediaType,
	normalizeImageInput,
	resolveImageUrl,
	type InputImage,
} from "@/lib/server/image-input"
import { uploadImageBuffer } from "@/lib/server/s3"

export const maxDuration = 30

const bodySchema = z.object({
	prompt: z.string().optional(),
	images: z
		.array(
			z.object({
				data: z.string().min(1),
				mediaType: z.string().min(1),
				imageUrl: z.string().url().optional(),
			}),
		)
		.min(1),
})

async function persistImageUrl(image: InputImage) {
	const existingUrl = resolveImageUrl(image)
	if (existingUrl) {
		return existingUrl
	}

	const { fileUrl } = await uploadImageBuffer({
		buffer: decodeImageData(image.data),
		contentType: image.mediaType,
		extension: extensionFromMediaType(image.mediaType),
	})

	return fileUrl
}

export async function POST(req: Request) {
	const json = await req.json().catch(() => null)
	const parsed = bodySchema.safeParse(json)

	if (!parsed.success) {
		return Response.json(
			{
				error:
					"Invalid request body. Expected { prompt?: string, images: Array<{ data: string; mediaType: string; imageUrl?: string }> }.",
			},
			{ status: 400 },
		)
	}

	const { prompt, images } = parsed.data
	const rowsToInsert: Array<{ embeddedImage: number[]; imageUrl: string | null }> = []

	for (const image of images) {
		const imageValue = normalizeImageInput(image)
		const analysis = await analyzeImage({
			prompt,
			image: imageValue,
			mediaType: image.mediaType,
		})
		const embedding = await embedImageAnalysis(analysis)
		const imageUrl = await persistImageUrl(image)
		rowsToInsert.push({ embeddedImage: embedding, imageUrl })
	}

	const saved = await db.insert(imagesTable).values(rowsToInsert).returning({
		id: imagesTable.id,
		imageUrl: imagesTable.imageUrl,
	})

	return Response.json({ count: saved.length, items: saved }, { status: 201 })
}
