import multer from "multer";
import path from "path";
import fs from "fs";

const baseUploadDir = path.join(__dirname, "..", "..", "uploads");
const imagesDir = path.join(baseUploadDir, "images");
const audioDir = path.join(baseUploadDir, "audio");

for (const dir of [baseUploadDir, imagesDir, audioDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Имя файла максимально совпадает с именем на компьютере пользователя.
// Браузеры на Windows могут присылать имя в кодировке latin1, поэтому
// перекодируем в UTF-8 и берём только basename (без каталогов).
function safeFilename(originalname: string) {
  const decoded = Buffer.from(originalname, "latin1").toString("utf8");
  const base = path.basename(decoded).replace(/[/\\]/g, "");
  return base || `${Date.now()}`;
}

function createStorage(targetDir: string) {
  return multer.diskStorage({
    destination: targetDir,
    filename: (_req, file, cb) => {
      cb(null, safeFilename(file.originalname));
    },
  });
}

// Разрешённые типы по ТЗ
const IMAGE_MIME_WHITELIST = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const AUDIO_MIME_WHITELIST = new Set([
  "audio/mpeg", // mp3
  "audio/mp3",
  "audio/x-m4a",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
]);

function createImageUploader() {
  return multer({
    storage: createStorage(imagesDir),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB
    },
    fileFilter: (_req, file, cb) => {
      if (IMAGE_MIME_WHITELIST.has(file.mimetype)) {
        return cb(null, true);
      }
      return cb(new Error("Недопустимый формат изображения"));
    },
  });
}

function createAudioUploader() {
  return multer({
    storage: createStorage(audioDir),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB
    },
    fileFilter: (_req, file, cb) => {
      if (AUDIO_MIME_WHITELIST.has(file.mimetype)) {
        return cb(null, true);
      }
      return cb(new Error("Недопустимый формат аудиофайла"));
    },
  });
}

// Отдельные upload-экземпляры для картинок и аудио
export const uploadImage = createImageUploader();
export const uploadAudio = createAudioUploader();
