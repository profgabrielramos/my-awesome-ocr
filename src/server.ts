import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ocr } from './index'; // Import the ocr function

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads'); // Store uploads outside dist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Keep original name but add timestamp to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Middleware to parse JSON bodies
app.use(express.json());

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.send('Llama OCR API is running!');
});

// OCR endpoint
app.post('/ocr', upload.single('imageFile'), async (req: Request, res: Response) => {
  const apiKey = process.env.TOGETHER_API_KEY;
  const model = req.body.model as "Llama-3.2-90B-Vision" | "Llama-3.2-11B-Vision" | "free" | undefined; // Allow model selection via body

  if (!apiKey) {
    return res.status(500).json({ error: 'TOGETHER_API_KEY environment variable not set.' });
  }

  let filePath: string | undefined = undefined;
  let isTemporary = false;

  try {
    // Check for file upload
    if (req.file) {
      filePath = req.file.path;
      isTemporary = true;
      console.log(`Processing uploaded file: ${filePath}`);
    }
    // Check for image URL in JSON body
    else if (req.body.imageUrl && typeof req.body.imageUrl === 'string') {
      filePath = req.body.imageUrl;
      if (!isRemoteFile(filePath)) {
         // Clean up temporary file if it exists and isn't a valid remote URL
         if (isTemporary && req.file?.path) {
            fs.unlink(req.file.path, (err) => {
              if (err) console.error(`Error deleting temp file ${req.file?.path}:`, err);
            });
          }
        return res.status(400).json({ error: 'Invalid imageUrl provided. Must be a valid URL starting with http:// or https://' });
      }
      console.log(`Processing remote image URL: ${filePath}`);
    } else {
      return res.status(400).json({ error: 'No imageFile (multipart/form-data) or imageUrl (JSON) provided.' });
    }

    // Call the OCR function
    const markdown = await ocr({
      filePath: filePath,
      apiKey: apiKey,
      model: model, // Pass model if provided
    });

    res.status(200).json({ markdown: markdown });

  } catch (error: any) {
    console.error('Error processing OCR request:', error);
    res.status(500).json({ error: 'Failed to process image.', details: error.message });
  } finally {
    // Clean up the uploaded file if it exists
    if (isTemporary && req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error(`Error deleting temp file ${req.file.path}:`, err);
        else console.log(`Deleted temp file: ${req.file.path}`);
      });
    }
  }
});

// Helper function (can be imported if modularized)
function isRemoteFile(filePath: string): boolean {
    return filePath.startsWith("http://") || filePath.startsWith("https://");
}


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Upload directory: ${path.resolve(uploadDir)}`); // Log resolved path
});
