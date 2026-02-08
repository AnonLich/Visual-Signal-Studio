import { pgTable, serial, text, vector } from "drizzle-orm/pg-core"

export const images = pgTable("images", {
	id: serial("id").primaryKey(),
	embeddedImage: vector("embeddedImage", { dimensions: 1536 }).notNull(),
	imageUrl: text("imageUrl"),
})
