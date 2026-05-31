const fs = require("fs/promises");
const path = require("path");

async function getProjectStoreRoot(project, projectPath, userDataPath) {
  const folderName = `${safeName(project.name || "storyboard-project")}.shotfactory-assets`;
  const root = projectPath
    ? path.join(path.dirname(projectPath), folderName)
    : path.join(userDataPath, "project-assets", project.id);
  await fs.mkdir(root, { recursive: true });
  await Promise.all([
    fs.mkdir(path.join(root, "generated"), { recursive: true }),
    fs.mkdir(path.join(root, "metadata"), { recursive: true }),
    fs.mkdir(path.join(root, "references"), { recursive: true }),
    fs.mkdir(path.join(root, "queue"), { recursive: true })
  ]);
  return root;
}

async function archiveImportedAsset(project, filePath, kind, index, context) {
  const root = await getProjectStoreRoot(project, context.projectPath, context.userDataPath);
  const ext = path.extname(filePath).toLowerCase() || ".png";
  const folder = path.join(root, "references", kind);
  await fs.mkdir(folder, { recursive: true });
  const id = crypto.randomUUID();
  const name = path.basename(filePath, path.extname(filePath));
  const storedPath = path.join(folder, `${String(index + 1).padStart(3, "0")}_${safeName(name)}_${id.slice(0, 8)}${ext}`);
  await fs.copyFile(filePath, storedPath);
  return {
    id,
    name,
    path: storedPath,
    sourcePath: filePath,
    previewUrl: await fileToDataUrl(storedPath),
    kind,
    x: 80 + (index % 2) * 190,
    y: 80 + Math.floor(index / 2) * 150,
    archivedAt: new Date().toISOString()
  };
}

async function archiveGeneratedImage(project, shot, result, context) {
  const root = await getProjectStoreRoot(project, context.projectPath, context.userDataPath);
  const outputFormat = normalizeFormat(context.settings?.outputFormat || project.settings?.outputFormat || "png");
  const image = await imageToBuffer(result.imageUrl, outputFormat, context.settings?.requestTimeoutSeconds || 180);
  const generatedDir = path.join(root, "generated");
  const metadataDir = path.join(root, "metadata");
  const baseName = buildOutputName(project, shot, context.index, context.settings?.outputPattern);
  const imagePath = path.join(generatedDir, `${baseName}.${image.ext}`);
  const metadataPath = path.join(metadataDir, `${baseName}.json`);

  await fs.writeFile(imagePath, image.buffer);
  const metadata = {
    id: crypto.randomUUID(),
    projectId: project.id,
    projectName: project.name,
    shotId: shot.id,
    shotTitle: shot.title,
    imagePath,
    prompt: shot.prompt,
    negativePrompt: shot.negativePrompt,
    dsl: shot.dsl,
    provider: result.provider,
    requestSize: result.requestSize,
    revisedPrompt: result.revisedPrompt || "",
    usage: result.usage || null,
    createdAt: result.createdAt || new Date().toISOString()
  };
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

  return {
    imageUrl: pathToFileUrl(imagePath),
    imagePath,
    metadataPath,
    assetRecord: metadata
  };
}

async function fileToDataUrl(filePath) {
  const buffer = await fs.readFile(filePath);
  return `data:${mimeFromPath(filePath)};base64,${buffer.toString("base64")}`;
}

async function imageToBuffer(imageUrl, fallbackFormat, timeoutSeconds) {
  if (!imageUrl) throw new Error("生图结果为空，无法归档图片文件。");
  const dataMatch = String(imageUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataMatch) {
    return {
      buffer: Buffer.from(dataMatch[2], "base64"),
      ext: extensionFromMime(dataMatch[1]) || fallbackFormat
    };
  }

  if (String(imageUrl).startsWith("file:///")) {
    const filePath = decodeURIComponent(String(imageUrl).replace(/^file:\/\//, ""));
    return {
      buffer: await fs.readFile(filePath),
      ext: extensionFromPath(filePath) || fallbackFormat
    };
  }

  if (/^https?:\/\//i.test(String(imageUrl))) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(30, Math.min(Number(timeoutSeconds) || 180, 900)) * 1000);
    try {
      const response = await fetch(imageUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`下载生成图片失败：${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        ext: extensionFromMime(response.headers.get("content-type")) || extensionFromPath(new URL(imageUrl).pathname) || fallbackFormat
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("生图结果不是 data URL、file URL 或 HTTP URL，无法归档。");
}

function buildOutputName(project, shot, index, pattern = "{project}_{shotId}_{title}") {
  const values = {
    project: project.name || "project",
    shotId: shot.id,
    title: shot.title || "shot",
    index: String((index || 0) + 1).padStart(3, "0"),
    date: new Date().toISOString().slice(0, 10)
  };
  const raw = String(pattern || "{project}_{shotId}_{title}").replace(/\{(project|shotId|title|index|date)\}/g, (_all, key) => values[key]);
  return safeName(raw).slice(0, 150) || `${values.index}_${safeName(values.title)}`;
}

function safeName(value) {
  return String(value || "asset")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "asset";
}

function pathToFileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function mimeFromPath(filePath) {
  const ext = extensionFromPath(filePath);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

function extensionFromPath(filePath) {
  const ext = path.extname(filePath || "").toLowerCase().replace(/^\./, "");
  if (ext === "jpeg") return "jpg";
  return ["png", "jpg", "webp"].includes(ext) ? ext : "";
}

function extensionFromMime(mime) {
  if (!mime) return "";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("png")) return "png";
  return "";
}

function normalizeFormat(format) {
  if (format === "jpeg") return "jpg";
  return ["png", "jpg", "webp"].includes(format) ? format : "png";
}

module.exports = {
  getProjectStoreRoot,
  archiveImportedAsset,
  archiveGeneratedImage,
  fileToDataUrl,
  pathToFileUrl
};
