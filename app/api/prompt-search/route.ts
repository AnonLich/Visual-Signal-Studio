import { z } from "zod"

const bodySchema = z.object({
	prompt: z.string().min(1),
})

export async function POST(req: Request) {
	const json = await req.json().catch(() => null)
	const parsed = bodySchema.safeParse(json)

	if (!parsed.success) {
		return Response.json(
			{ error: "Invalid request body. Expected { prompt: string }." },
			{ status: 400 }
		)
	}

	return Response.json(
		{
			ok: true,
			prompt: parsed.data.prompt,
		},
		{ status: 200 }
	)
}
