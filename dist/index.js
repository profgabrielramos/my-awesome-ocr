"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocr = ocr;
const together_ai_1 = __importDefault(require("together-ai"));
const fs_1 = __importDefault(require("fs"));
function ocr(_a) {
    return __awaiter(this, arguments, void 0, function* ({ filePath, apiKey = process.env.TOGETHER_API_KEY, model = "Llama-3.2-90B-Vision", }) {
        if (!apiKey) {
            throw new Error("Together AI API key is required. Provide it via apiKey parameter or TOGETHER_API_KEY environment variable.");
        }
        const visionLLM = model === "free"
            ? "meta-llama/Llama-Vision-Free"
            : `meta-llama/${model}-Instruct-Turbo`;
        const together = new together_ai_1.default({
            apiKey,
        });
        console.log(`Using model: ${visionLLM}`); // Log model being used
        let finalMarkdown = yield getMarkDown({ together, visionLLM, filePath });
        return finalMarkdown;
    });
}
function getMarkDown(_a) {
    return __awaiter(this, arguments, void 0, function* ({ together, visionLLM, filePath, }) {
        var _b;
        const systemPrompt = `Convert the provided image into Markdown format. Ensure that all content from the page is included, such as headers, footers, subtexts, images (with alt text if possible), tables, and any other elements.

  Requirements:

  - Output Only Markdown: Return solely the Markdown content without any additional explanations or comments.
  - No Delimiters: Do not use code fences or delimiters like \`\`\`markdown.
  - Complete Content: Do not omit any part of the page, including headers, footers, and subtext.
  `;
        const isRemote = isRemoteFile(filePath);
        let finalImageUrl;
        if (isRemote) {
            finalImageUrl = filePath;
            console.log(`Fetching remote image: ${finalImageUrl}`);
        }
        else {
            try {
                finalImageUrl = `data:image/jpeg;base64,${encodeImage(filePath)}`;
                console.log(`Encoding local image: ${filePath}`);
            }
            catch (error) {
                console.error(`Error reading or encoding local file ${filePath}:`, error);
                throw new Error(`Failed to read or encode local file: ${filePath}. Details: ${error.message}`);
            }
        }
        try {
            console.log(`Sending request to Together AI with model ${visionLLM}...`);
            const output = yield together.chat.completions.create({
                model: visionLLM,
                max_tokens: 4096, // Increase max tokens potentially needed for dense images
                messages: [
                    {
                        role: "user",
                        // @ts-expect-error - Together AI SDK might have type mismatch for content array
                        content: [
                            { type: "text", text: systemPrompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: finalImageUrl,
                                },
                            },
                        ],
                    },
                ],
            });
            console.log("Received response from Together AI.");
            if (!output.choices || output.choices.length === 0 || !((_b = output.choices[0].message) === null || _b === void 0 ? void 0 : _b.content)) {
                console.error("Invalid response structure from Together AI:", output);
                throw new Error("Received invalid or empty response from Together AI.");
            }
            return output.choices[0].message.content;
        }
        catch (error) {
            console.error("Error during Together AI API call:", error);
            // Log more details if available (e.g., response status or body)
            if (error.response) {
                console.error("API Response Status:", error.response.status);
                console.error("API Response Data:", error.response.data);
            }
            throw new Error(`API call to Together AI failed. Details: ${error.message}`);
        }
    });
}
function encodeImage(imagePath) {
    const imageFile = fs_1.default.readFileSync(imagePath);
    return Buffer.from(imageFile).toString("base64");
}
function isRemoteFile(filePath) {
    return filePath.startsWith("http://") || filePath.startsWith("https://");
}
