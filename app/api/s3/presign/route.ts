import { randomUUID } from "crypto"
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { z } from "zod"

const uploadBodySchema = z.object({
	fileName: z.string().min(1),
	contentType: z.string().min(1),
})

const viewBodySchema = z.object({
	imageUrl: z.string().url(),
})

function getRequiredEnv(name: string): string {
	const value = process.env[name]
	if (!value) {
		throw new Error(`Missing required env var: ${name}`)
	}

	return value
}

const region = getRequiredEnv("AWS_REGION")
const bucket = getRequiredEnv("S3_BUCKET")

const s3 = new S3Client({
	region,
	credentials: {
		accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
		secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
	},
})

function extractS3KeyFromUrl(imageUrl: string) {
	const url = new URL(imageUrl)
	const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""))

	if (!key) {
		throw new Error("Invalid imageUrl. Could not resolve object key.")
	}

	return key
}

export async function POST(req: Request) {
	const json = await req.json().catch(() => null)

	const uploadParsed = uploadBodySchema.safeParse(json)
	if (uploadParsed.success) {
		const { fileName, contentType } = uploadParsed.data
		const key = `uploads/${randomUUID()}-${fileName}`

		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			ContentType: contentType,
		})

		const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 })
		const encodedKey = key
			.split("/")
			.map((part) => encodeURIComponent(part))
			.join("/")
		const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`

		return Response.json({ uploadUrl, fileUrl, key }, { status: 200 })
	}

	const viewParsed = viewBodySchema.safeParse(json)
	if (viewParsed.success) {
		const key = extractS3KeyFromUrl(viewParsed.data.imageUrl)
		const command = new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		})

		const viewUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
		return Response.json({ viewUrl, key }, { status: 200 })
	}

	return Response.json(
		{
			error:
				"Invalid request body. Expected either { fileName: string, contentType: string } or { imageUrl: string }.",
		},
		{ status: 400 },
	)
}
