import Together from "together-ai";
import fs from "fs";

export async function ocr({
  filePath,
  apiKey = process.env.TOGETHER_API_KEY,
  model = "Llama-3.2-90B-Vision",
}: {
  filePath: string;
  apiKey?: string;
  model?: "Llama-3.2-90B-Vision" | "Llama-3.2-11B-Vision" | "free";
}) {
  if (!apiKey) {
    throw new Error("Together AI API key is required. Provide it via apiKey parameter or TOGETHER_API_KEY environment variable.");
  }

  const visionLLM =
    model === "free"
      ? "meta-llama/Llama-Vision-Free"
      : `meta-llama/${model}-Instruct-Turbo`;

  const together = new Together({
    apiKey,
  });

  console.log(`Using model: ${visionLLM}`); // Log model being used

  let finalMarkdown = await getMarkDown({ together, visionLLM, filePath });

  return finalMarkdown;
}

async function getMarkDown({
  together,
  visionLLM,
  filePath,
}: {
  together: Together;
  visionLLM: string;
  filePath: string;
}) {
  const systemPrompt = `Convert the provided image into Markdown format. Ensure that all content from the page is included, such as headers, footers, subtexts, images (with alt text if possible), tables, and any other elements.

  Requirements:

  - Output Only Markdown: Return solely the Markdown content without any additional explanations or comments.
  - No Delimiters: Do not use code fences or delimiters like \`\`\`markdown.
  - Complete Content: Do not omit any part of the page, including headers, footers, and subtext.
  `;

  const isRemote = isRemoteFile(filePath);
  let finalImageUrl: string;

  if (isRemote) {
    finalImageUrl = filePath;
    console.log(`Fetching remote image: ${finalImageUrl}`);
  } else {
    try {
      finalImageUrl = `data:image/jpeg;base64,${encodeImage(filePath)}`;
      console.log(`Encoding local image: ${filePath}`);
    } catch (error: any) {
      console.error(`Error reading or encoding local file ${filePath}:`, error);
      throw new Error(`Failed to read or encode local file: ${filePath}. Details: ${error.message}`);
    }
  }


  try {
    console.log(`Sending request to Together AI with model ${visionLLM}...`);
    const output = await together.chat.completions.create({
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

    if (!output.choices || output.choices.length === 0 || !output.choices[0].message?.content) {
        console.error("Invalid response structure from Together AI:", output);
        throw new Error("Received invalid or empty response from Together AI.");
    }


    return output.choices[0].message.content;
  } catch (error: any) {
      console.error("Error during Together AI API call:", error);
      // Log more details if available (e.g., response status or body)
      if (error.response) {
          console.error("API Response Status:", error.response.status);
          console.error("API Response Data:", error.response.data);
      }
      throw new Error(`API call to Together AI failed. Details: ${error.message}`);
  }
}

function encodeImage(imagePath: string): string {
  const imageFile = fs.readFileSync(imagePath);
  return Buffer.from(imageFile).toString("base64");
}

function isRemoteFile(filePath: string): boolean {
  return filePath.startsWith("http://") || filePath.startsWith("https://");
}
