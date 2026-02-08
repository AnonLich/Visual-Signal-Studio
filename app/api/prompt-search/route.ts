import { z } from "zod"
import { openai } from "@ai-sdk/openai"
import { embed } from "ai"
import { db } from "@/db"
import { images } from "@/db/schema"
import { cosineDistance } from "drizzle-orm/sql/functions"
import { asc } from "drizzle-orm"

const bodySchema = z.object({
	prompt: z.string().min(1),
	limit: z.number().int().positive().max(20).optional(),
})

export async function POST(req: Request) {
	const json = await req.json().catch(() => null)
	const parsed = bodySchema.safeParse(json)

	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid request body. Expected { prompt: string }." },
			{ status: 400 },
		)
	}

	const embeddingResult = await embed({
		model: openai.embedding("text-embedding-3-small"),
		value: parsed.data.prompt,
	})

	const distance = cosineDistance(images.embeddedImage, embeddingResult.embedding)
	const limit = parsed.data.limit ?? 5

	const matches = await db
		.select({
			id: images.id,
			imageUrl: images.imageUrl,
			distance,
		})
		.from(images)
		.orderBy(asc(distance))
		.limit(limit)

	return Response.json({ ok: true, prompt: parsed.data.prompt, matches }, { status: 200 })
}
