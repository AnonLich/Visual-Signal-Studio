import { db } from "@/db"
import { images } from "@/db/schema"

export async function GET() {
	const result = await db.select().from(images)
	return Response.json(result)
}

export async function POST(req: Request) {
	const body = await req.json().catch(() => null)
	return Response.json({ ok: true, body })
}
