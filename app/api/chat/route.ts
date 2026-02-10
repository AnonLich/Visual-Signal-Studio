import { z } from "zod"
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
	TrendStrategySchema,
} from "@/lib/server/trend-orchestrator"

export const maxDuration = 60

const analyzeSchema = z.object({
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

const refineSchema = z.object({
	mode: z.literal("refine"),
	feedback: z.string().min(1),
	currentStrategy: TrendStrategySchema,
	imageUrl: z.string().url().optional(),
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
	const refineParsed = refineSchema.safeParse(json)
	if (refineParsed.success) {
		const { feedback, currentStrategy, imageUrl } = refineParsed.data
		const encoder = new TextEncoder()
		const stream = new ReadableStream({
			start(controller) {
				const send = (event: Record<string, unknown>) => {
					controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
				}
				;(async () => {
					try {
						send({ type: "status", message: "Refinement started." })
						const strategy = await refineTrendStrategy(
							{ feedback, currentStrategy, imageUrl },
						)
						send({ type: "refine-complete", strategy })
					} catch (error) {
						const message =
							error instanceof Error ? error.message : "Unknown refinement error."
						send({ type: "error", message })
					} finally {
						controller.close()
					}
				})()
			},
		})
		return new Response(stream, {
			headers: {
				"content-type": "application/x-ndjson; charset=utf-8",
				"cache-control": "no-cache, no-transform",
				connection: "keep-alive",
			},
		})
	}

	const parsed = analyzeSchema.safeParse(json)
	if (!parsed.success) {
		return Response.json(
			{
				error:
					"Invalid request body. Expected { prompt?: string, images: Array<{ data: string; mediaType: string; imageUrl?: string }> } or { mode: 'refine', feedback, currentStrategy }.",
			},
			{ status: 400 },
		)
	}

	const { images } = parsed.data
	const encoder = new TextEncoder()

	const stream = new ReadableStream({
		start(controller) {
			const send = (event: Record<string, unknown>) => {
				controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
			}

			;(async () => {
				const results: Array<{
					imageUrl: string
					strategy: Awaited<ReturnType<typeof orchestrateTrendMatch>>
				}> = []

				try {
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
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: "Unknown pipeline error."
					send({
						type: "error",
						message,
					})
				} finally {
					controller.close()
				}
			})()
		},
	})

	return new Response(stream, {
		headers: {
			"content-type": "application/x-ndjson; charset=utf-8",
			"cache-control": "no-cache, no-transform",
			connection: "keep-alive",
		},
	})
}
