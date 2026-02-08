import type { Config } from "drizzle-kit"

if (!process.env.DATABASE_URL) {
	throw new Error(
		"Missing DATABASE_URL. Add it to .env.local or your shell environment.",
	)
}

export default {
	schema: "./db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
} satisfies Config
