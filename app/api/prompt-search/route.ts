import { openai } from "@ai-sdk/openai"
import { convertToModelMessages, streamText } from "ai"
import { z } from "zod"
import { searchImagesByPrompt } from "@/lib/server/vector-search"

const bodySchema = z.object({
	messages: z.array(z.any()).min(1),
})

export async function POST(req: Request) {
	const json = await req.json().catch(() => null)
	const parsed = bodySchema.safeParse(json)

	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid request body. Expected chat messages." },
			{ status: 400 },
		)
	}

	const modelMessages = await convertToModelMessages(parsed.data.messages)

	const result = streamText({
		model: openai("gpt-4.1-mini"),
		system:
			"You are an image search assistant. When users ask to find matching images, call the searchImages tool. After tool results are available, always respond with a short natural language summary of the top matches (id + distance).",
		messages: modelMessages,
		tools: {
			searchImages: {
				description:
					"Semantic vector search for previously analyzed images using a text prompt.",
				inputSchema: z.object({
					prompt: z.string().min(1),
					limit: z.number().int().positive().max(20).default(5),
				}),
				execute: async ({ prompt, limit }) => {
					const matches = await searchImagesByPrompt(prompt, limit)
					return { matches }
				},
			},
		},
	})

	return result.toUIMessageStreamResponse()
}
