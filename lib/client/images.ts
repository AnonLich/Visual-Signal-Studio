export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			if (typeof reader.result !== "string") {
				reject(new Error("Failed to read file"))
				return
			}

			const [, base64] = reader.result.split(",")
			resolve(base64 ?? "")
		}

		reader.onerror = () => reject(new Error("Failed to read file"))
		reader.readAsDataURL(file)
	})
}
