import {
	decodeImageData,
	extensionFromMediaType,
	normalizeImageInput,
	resolveImageUrl,
	type InputImage,
} from "@/lib/server/image-input"
import { uploadImageBuffer } from "@/lib/server/s3"
import {
	orchestrateTrendMatch,
	refineTrendStrategy,
} from "@/lib/server/trend-orchestrator"
import { AnalyzeRequestSchema, RefineRequestSchema } from "./schemas"
import type { AnalyzeResultItem, StreamEvent, StreamRunner } from "./types"

export const maxDuration = 60
const NDJSON_HEADERS = {
	"content-type": "application/x-ndjson; charset=utf-8",
	"cache-control": "no-cache, no-transform",
	connection: "keep-alive",
}

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

function createNdjsonStream(run: StreamRunner) {
	const encoder = new TextEncoder()

	return new ReadableStream({
		async start(controller) {
			const send = (event: StreamEvent) => {
				controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
			}

			try {
				await run({ send })
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "Unknown stream error."
				send({ type: "error", message })
			} finally {
				controller.close()
			}
		},
	})
}

function createNdjsonResponse(stream: ReadableStream) {
	return new Response(stream, { headers: NDJSON_HEADERS })
}

export async function POST(req: Request) {
	const json = await req.json().catch(() => null)
	const refineParsed = RefineRequestSchema.safeParse(json)
	if (refineParsed.success) {
		const { feedback, currentStrategy, imageUrl } = refineParsed.data
		const stream = createNdjsonStream(async ({ send }) => {
			send({ type: "status", message: "Refinement started." })
			const strategy = await refineTrendStrategy({
				feedback,
				currentStrategy,
				imageUrl,
			})
			send({ type: "refine-complete", strategy })
		})
		return createNdjsonResponse(stream)
	}

	const parsed = AnalyzeRequestSchema.safeParse(json)
	if (!parsed.success) {
		return Response.json(
			{
				error: "Invalid request body. Expected { prompt?: string, images: Array<{ data: string; mediaType: string; imageUrl?: string }> } or { mode: 'refine', feedback, currentStrategy }.",
			},
			{ status: 400 },
		)
	}

	const { images } = parsed.data
	const stream = createNdjsonStream(async ({ send }) => {
		const results: AnalyzeResultItem[] = []

		send({
			type: "status",
			message:
				"Request accepted. Starting upload + orchestration pipeline.",
		})

		for (const [index, image] of images.entries()) {
			const imageIndex = index + 1
			send({
				type: "status",
				imageIndex,
				message: "Uploading image...",
			})

			const imageUrl = await persistImageUrl(image)
			send({
				type: "uploaded",
				imageIndex,
				imageUrl,
			})

			send({
				type: "status",
				imageIndex,
				message: "Starting trend orchestration...",
			})

			const strategy = await orchestrateTrendMatch(
				{
					image: normalizeImageInput(image),
					mediaType: image.mediaType,
					imageUrl,
				},
				{
					onStep: (step) => {
						send({
							type: "step",
							imageIndex,
							...step,
						})
					},
				},
			)

			const item = { imageUrl, strategy }
			results.push(item)
			send({
				type: "image-complete",
				imageIndex,
				...item,
			})
		}

		send({
			type: "complete",
			count: results.length,
			items: results,
		})
	})
	return createNdjsonResponse(stream)
}
