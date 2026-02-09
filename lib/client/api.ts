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

export type TrendStrategy = {
	strategicBrief: string
	contentIdeas: unknown[]
	tiktokLinks: Array<{ url: string; trendContext: string }>
	reasoning: string
}

export type TrendStreamEvent =
	| { type: "status"; message: string; imageIndex?: number }
	| { type: "uploaded"; imageIndex: number; imageUrl: string }
	| {
			type: "step"
			imageIndex: number
			phase?: "refine"
			stepNumber: number
			text?: string
			reasoningText?: string
			toolCalls: Array<{ toolName: string; input: unknown }>
			toolResults: Array<{ toolName: string; output: unknown }>
	  }
	| {
			type: "image-complete"
			imageIndex: number
			imageUrl: string
			strategy: unknown
	  }
	| {
			type: "complete"
			count: number
			items: Array<{ imageUrl: string; strategy: TrendStrategy }>
	  }
	| { type: "refine-complete"; strategy: TrendStrategy }
	| { type: "error"; message: string }

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

export async function analyzeImagesStream(
	payload: {
		prompt: string
		images: AnalyzeImagePayload[]
	},
	onEvent: (event: TrendStreamEvent) => void,
) {
	const res = await fetch("/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	})

	if (!res.ok) {
		throw new Error(`Analyze stream request failed with status ${res.status}`)
	}

	if (!res.body) {
		throw new Error("Analyze stream response body is missing")
	}

	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ""

	while (true) {
		const { done, value } = await reader.read()
		if (done) break

		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split("\n")
		buffer = lines.pop() ?? ""

		for (const line of lines) {
			const trimmed = line.trim()
			if (!trimmed) continue
			onEvent(JSON.parse(trimmed) as TrendStreamEvent)
		}
	}

	const tail = buffer.trim()
	if (tail) {
		onEvent(JSON.parse(tail) as TrendStreamEvent)
	}
}

export async function refineStrategyStream(
	payload: {
		feedback: string
		currentStrategy: TrendStrategy
		imageUrl?: string
	},
	onEvent: (event: TrendStreamEvent) => void,
) {
	const res = await fetch("/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			mode: "refine",
			...payload,
		}),
	})

	if (!res.ok) {
		throw new Error(`Refine request failed with status ${res.status}`)
	}

	if (!res.body) {
		throw new Error("Refine response body is missing")
	}

	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ""

	while (true) {
		const { done, value } = await reader.read()
		if (done) break

		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split("\n")
		buffer = lines.pop() ?? ""

		for (const line of lines) {
			const trimmed = line.trim()
			if (!trimmed) continue
			onEvent(JSON.parse(trimmed) as TrendStreamEvent)
		}
	}

	const tail = buffer.trim()
	if (tail) {
		onEvent(JSON.parse(tail) as TrendStreamEvent)
	}
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
