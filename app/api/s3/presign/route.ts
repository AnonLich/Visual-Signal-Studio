import { z } from "zod"
import { createUploadPresign, createViewPresign } from "@/lib/server/s3"

const uploadBodySchema = z.object({
	fileName: z.string().min(1),
	contentType: z.string().min(1),
})

const viewBodySchema = z.object({
	imageUrl: z.string().url(),
})

export async function POST(req: Request) {
	const json = await req.json().catch(() => null)

	const uploadParsed = uploadBodySchema.safeParse(json)
	if (uploadParsed.success) {
		const result = await createUploadPresign(uploadParsed.data)
		return Response.json(result, { status: 200 })
	}

	const viewParsed = viewBodySchema.safeParse(json)
	if (viewParsed.success) {
		const result = await createViewPresign(viewParsed.data)
		return Response.json(result, { status: 200 })
	}

	return Response.json(
		{
			error:
				"Invalid request body. Expected either { fileName: string, contentType: string } or { imageUrl: string }.",
		},
		{ status: 400 },
	)
}
