export declare function ocr({ filePath, apiKey, model, }: {
    filePath: string;
    apiKey?: string;
    model?: "Llama-3.2-90B-Vision" | "Llama-3.2-11B-Vision" | "free";
}): Promise<string>;
