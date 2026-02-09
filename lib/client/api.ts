export type SearchMatch = {
	id: number
	imageUrl: string | null
	distance: number
}

export type SearchResponse = {
	ok: boolean
	prompt: string
	matches: SearchMatch[]
}

export type SearchDisplayMatch = SearchMatch & {
	signedImageUrl: string | null | undefined
}

type AnalyzeImagePayload = {
	data: string
	mediaType: string
}

async function parseJsonOrThrow<T>(res: Response, context: string): Promise<T> {
	if (!res.ok) {
		throw new Error(`${context} failed with status ${res.status}`)
	}

	return (await res.json()) as T
}

export async function analyzeImages(payload: {
	prompt: string
	images: AnalyzeImagePayload[]
}) {
	const res = await fetch("/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	})

	return parseJsonOrThrow<unknown>(res, "Analyze request")
}

export async function searchByPrompt(prompt: string) {
	const res = await fetch("/api/prompt-search", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ prompt }),
	})

	return parseJsonOrThrow<SearchResponse>(res, "Prompt search request")
}

export async function presignViewUrl(imageUrl: string) {
	const res = await fetch("/api/s3/presign", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ imageUrl }),
	})

	const json = await parseJsonOrThrow<{ viewUrl: string }>(
		res,
		"View URL presign request",
	)
	return json.viewUrl
}

export async function hydrateSearchMatches(matches: SearchMatch[]) {
	return Promise.all(
		matches.map(async (match) => {
			if (!match.imageUrl) {
				return { ...match, signedImageUrl: null }
			}

			const signedImageUrl = await presignViewUrl(match.imageUrl)
			return { ...match, signedImageUrl }
		}),
	)
}
