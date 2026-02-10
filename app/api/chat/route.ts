import {
	normalizeImageInput,
	resolveImageUrl,
} from "@/lib/server/image-input"
import {
	orchestrateTrendMatch,
	refineTrendStrategy,
} from "@/lib/server/trend-orchestrator"
import { AnalyzeRequestSchema, RefineRequestSchema } from "./schemas"
import type { StreamEvent, StreamRunner } from "./types"

export const maxDuration = 60
const NDJSON_HEADERS = {
	"content-type": "application/x-ndjson; charset=utf-8",
	"cache-control": "no-cache, no-transform",
	connection: "keep-alive",
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
				error: "Invalid request body. Expected { prompt?: string, image: { data: string; mediaType: string; imageUrl?: string } } or { mode: 'refine', feedback, currentStrategy }.",
			},
			{ status: 400 },
		)
	}

	const { image } = parsed.data
	const stream = createNdjsonStream(async ({ send }) => {
		send({
			type: "status",
			message: "Request accepted. Starting analysis pipeline.",
		})

		const imageUrl = resolveImageUrl(image)

		send({
			type: "status",
			message: "Preparing image input...",
		})

		send({
			type: "uploaded",
			imageUrl,
		})

		send({
			type: "status",
			message: "Starting trend orchestration...",
		})

		const strategy = await orchestrateTrendMatch(
			{
				image: normalizeImageInput(image),
				mediaType: image.mediaType,
				imageUrl: imageUrl ?? undefined,
			},
			{
				onStep: (step) => {
					send({
						type: "step",
						...step,
					})
				},
			},
		)

		send({
			type: "image-complete",
			imageUrl,
			strategy,
		})

		send({
			type: "complete",
			imageUrl,
			strategy,
		})
	})
	return createNdjsonResponse(stream)
}
