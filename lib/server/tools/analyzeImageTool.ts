import { z } from "zod"
import { analysisToStrategicBrief, analyzeImage } from "../image-analysis"

type AnalyzeImageToolParams = {
	image: string
	mediaType: string
}

export function createAnalyzeImageTool({
	image,
	mediaType,
}: AnalyzeImageToolParams) {
	return {
		description: "Extract the visual DNA and market segment of the image.",
		inputSchema: z.object({}),
		execute: async () => {
			const analysis = await analyzeImage({ image, mediaType })
			return {
				analysis,
				strategicBrief: analysisToStrategicBrief(analysis),
			}
		},
	}
}
