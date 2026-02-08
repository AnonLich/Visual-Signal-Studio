import "server-only"
import { randomUUID } from "crypto"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getRequiredEnv } from "@/lib/server/env"

type UploadPresignParams = {
	fileName: string
	contentType: string
	expiresInSeconds?: number
}

type ViewPresignParams = {
	imageUrl: string
	expiresInSeconds?: number
}

type UploadBufferParams = {
	buffer: Buffer
	contentType: string
	extension: string
	keyPrefix?: string
}

function getS3Config() {
	return {
		region: getRequiredEnv("AWS_REGION"),
		bucket: getRequiredEnv("S3_BUCKET"),
		accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
		secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
	}
}

function getS3Client() {
	const { region, accessKeyId, secretAccessKey } = getS3Config()

	return new S3Client({
		region,
		credentials: {
			accessKeyId,
			secretAccessKey,
		},
	})
}

function encodeKeyForUrl(key: string) {
	return key
		.split("/")
		.map((part) => encodeURIComponent(part))
		.join("/")
}

function buildS3FileUrl(key: string) {
	const { region, bucket } = getS3Config()
	return `https://${bucket}.s3.${region}.amazonaws.com/${encodeKeyForUrl(key)}`
}

function extractS3KeyFromUrl(imageUrl: string) {
	const url = new URL(imageUrl)
	const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""))

	if (!key) {
		throw new Error("Invalid imageUrl. Could not resolve object key.")
	}

	return key
}

export async function createUploadPresign({
	fileName,
	contentType,
	expiresInSeconds = 60,
}: UploadPresignParams) {
	const s3 = getS3Client()
	const { bucket } = getS3Config()
	const key = `uploads/${randomUUID()}-${fileName}`

	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		ContentType: contentType,
	})

	const uploadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
	return { uploadUrl, fileUrl: buildS3FileUrl(key), key }
}

export async function createViewPresign({
	imageUrl,
	expiresInSeconds = 300,
}: ViewPresignParams) {
	const s3 = getS3Client()
	const { bucket } = getS3Config()
	const key = extractS3KeyFromUrl(imageUrl)

	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
	})

	const viewUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
	return { viewUrl, key }
}

export async function uploadImageBuffer({
	buffer,
	contentType,
	extension,
	keyPrefix = "uploads",
}: UploadBufferParams) {
	const s3 = getS3Client()
	const { bucket } = getS3Config()
	const key = `${keyPrefix}/${randomUUID()}.${extension}`

	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: buffer,
			ContentType: contentType,
		}),
	)

	return { key, fileUrl: buildS3FileUrl(key) }
}
