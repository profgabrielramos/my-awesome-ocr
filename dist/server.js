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
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const index_1 = require("./index"); // Import the ocr function
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Configure multer for file uploads
const uploadDir = path_1.default.join(__dirname, '..', 'uploads'); // Store uploads outside dist
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Keep original name but add timestamp to avoid conflicts
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({ storage: storage });
// Middleware to parse JSON bodies
app.use(express_1.default.json());
// Root endpoint
app.get('/', (req, res) => {
    res.send('Llama OCR API is running!');
});
// OCR endpoint
app.post('/ocr', upload.single('imageFile'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const apiKey = process.env.TOGETHER_API_KEY;
    const model = req.body.model; // Allow model selection via body
    if (!apiKey) {
        return res.status(500).json({ error: 'TOGETHER_API_KEY environment variable not set.' });
    }
    let filePath = undefined;
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
                if (isTemporary && ((_a = req.file) === null || _a === void 0 ? void 0 : _a.path)) {
                    fs_1.default.unlink(req.file.path, (err) => {
                        var _a;
                        if (err)
                            console.error(`Error deleting temp file ${(_a = req.file) === null || _a === void 0 ? void 0 : _a.path}:`, err);
                    });
                }
                return res.status(400).json({ error: 'Invalid imageUrl provided. Must be a valid URL starting with http:// or https://' });
            }
            console.log(`Processing remote image URL: ${filePath}`);
        }
        else {
            return res.status(400).json({ error: 'No imageFile (multipart/form-data) or imageUrl (JSON) provided.' });
        }
        // Call the OCR function
        const markdown = yield (0, index_1.ocr)({
            filePath: filePath,
            apiKey: apiKey,
            model: model, // Pass model if provided
        });
        res.status(200).json({ markdown: markdown });
    }
    catch (error) {
        console.error('Error processing OCR request:', error);
        res.status(500).json({ error: 'Failed to process image.', details: error.message });
    }
    finally {
        // Clean up the uploaded file if it exists
        if (isTemporary && ((_b = req.file) === null || _b === void 0 ? void 0 : _b.path)) {
            fs_1.default.unlink(req.file.path, (err) => {
                if (err)
                    console.error(`Error deleting temp file ${req.file.path}:`, err);
                else
                    console.log(`Deleted temp file: ${req.file.path}`);
            });
        }
    }
}));
// Helper function (can be imported if modularized)
function isRemoteFile(filePath) {
    return filePath.startsWith("http://") || filePath.startsWith("https://");
}
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Upload directory: ${path_1.default.resolve(uploadDir)}`); // Log resolved path
});
