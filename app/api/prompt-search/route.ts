import { openai } from "@ai-sdk/openai"
import { convertToModelMessages, streamText } from "ai"
import { searchImagesByPrompt } from "@/lib/server/vector-search"
import {
	PromptSearchBodySchema,
	SearchImagesToolInputSchema,
} from "./schemas"
import type { SearchImagesToolInput } from "./types"

export async function POST(req: Request) {
	const json = await req.json().catch(() => null)
	const parsed = PromptSearchBodySchema.safeParse(json)

	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid request body. Expected chat messages." },
			{ status: 400 },
		)
	}

	const modelMessages = await convertToModelMessages(parsed.data.messages)

	const result = streamText({
		model: openai.chat("gpt-4.1-mini"),
		system:
			"You are an image search assistant. When users ask to find matching images, call the searchImages tool. After tool results are available, always respond with a short natural language summary of the top matches (id + distance).",
		messages: modelMessages,
		tools: {
			searchImages: {
				description:
					"Semantic vector search for previously analyzed images using a text prompt.",
				inputSchema: SearchImagesToolInputSchema,
				execute: async ({ prompt, limit }: SearchImagesToolInput) => {
					const matches = await searchImagesByPrompt(prompt, limit)
					return { matches }
				},
			},
		},
	})

	return result.toUIMessageStreamResponse()
}
