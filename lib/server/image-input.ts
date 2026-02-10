import "server-only"

export type InputImage = {
	data: string
	mediaType: string
	imageUrl?: string
}

export function normalizeImageInput(image: Pick<InputImage, "data" | "mediaType">) {
	const isAlreadyDataUrl = image.data.startsWith("data:")
	const isUrl = /^https?:\/\//i.test(image.data)

	return isAlreadyDataUrl || isUrl
		? image.data
		: `data:${image.mediaType};base64,${image.data}`
}

export function resolveImageUrl(image: Pick<InputImage, "data" | "imageUrl">) {
	if (typeof image.imageUrl === "string" && image.imageUrl.trim().length > 0) {
		return image.imageUrl.trim()
	}

	return /^https?:\/\//i.test(image.data) ? image.data : null
}
