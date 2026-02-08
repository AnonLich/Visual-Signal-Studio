import { pgTable, serial, text } from "drizzle-orm/pg-core"

export const images = pgTable("images", {
	id: serial("id").primaryKey(),
	embeddedImage: text("embeddedImage").notNull(),
})
