import "server-only"
import { openai } from "@ai-sdk/openai"
import { embed } from "ai"
import { asc } from "drizzle-orm"
import { cosineDistance } from "drizzle-orm/sql/functions"
import { db } from "@/db"
import { images } from "@/db/schema"

export type VectorSearchMatch = {
	id: number
	imageUrl: string | null
	distance: number
}

export async function searchImagesByPrompt(prompt: string, limit = 5) {
	const embeddingResult = await embed({
		model: openai.embedding("text-embedding-3-small"),
		value: prompt,
	})

	const distance = cosineDistance(images.embeddedImage, embeddingResult.embedding)

	const matches = await db
		.select({
			id: images.id,
			imageUrl: images.imageUrl,
			distance,
		})
		.from(images)
		.orderBy(asc(distance))
		.limit(limit)

	return matches as VectorSearchMatch[]
}
