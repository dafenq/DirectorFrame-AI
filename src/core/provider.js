async function generateImage(shot, settings = {}) {
  if (settings.provider === "openai") {
    return generateOpenAIImage(shot, settings);
  }

  if (settings.provider === "custom") {
    return generateCustomImage(shot, settings);
  }

  throw new Error("Production mode requires a real provider. Choose GPT Image or Custom Provider and configure the API settings.");
}

async function generateOpenAIImage(shot, settings) {
  if (!settings.apiKey) {
    throw new Error("Missing OpenAI API Key");
  }

  const body = buildOpenAIImageBody(shot, settings);
  const apiBaseUrl = normalizeApiBaseUrl(settings.apiBaseUrl || "https://api.openai.com/v1");
  const response = await fetchWithTimeout(`${apiBaseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, getRequestTimeoutMs(settings), settings.abortSignal);

  const text = await response.text();
  const payload = text ? safeJson(text) : {};
  if (!response.ok) {
    throw new Error(readProviderError(payload, text, `OpenAI image request failed: ${response.status}`));
  }

  const image = extractImageResult(payload, body.output_format);
  if (!image.imageUrl) {
    throw new Error("OpenAI response did not include an image. Check model access, billing, organization verification, and /images/generations support.");
  }

  return {
    imageUrl: image.imageUrl,
    revisedPrompt: image.revisedPrompt || "",
    provider: "openai",
    usage: payload.usage || null,
    requestSize: body.size,
    createdAt: payload.created ? new Date(payload.created * 1000).toISOString() : new Date().toISOString(),
    status: "success"
  };
}

async function generateCustomImage(shot, settings) {
  if (!settings.customEndpoint) {
    throw new Error("Missing custom image endpoint");
  }

  const outputFormat = normalizeOutputFormat(settings.outputFormat || "png");
  const response = await fetchWithTimeout(settings.customEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey ? { "Authorization": `Bearer ${settings.apiKey}` } : {})
    },
    body: JSON.stringify({
      prompt: shot.prompt,
      negativePrompt: shot.negativePrompt,
      negative_prompt: shot.negativePrompt,
      model: settings.model,
      size: normalizeOpenAIImageSize(settings.size || settings.aspectRatio),
      aspectRatio: settings.aspectRatio,
      aspect_ratio: settings.aspectRatio,
      quality: settings.quality,
      outputFormat,
      output_format: outputFormat,
      shot
    })
  }, getRequestTimeoutMs(settings), settings.abortSignal);

  const text = await response.text();
  const payload = text ? safeJson(text) : {};
  if (!response.ok) {
    throw new Error(readProviderError(payload, text, `Custom provider failed: ${response.status}`));
  }

  const image = extractImageResult(payload, outputFormat);
  if (!image.imageUrl) {
    throw new Error("Custom provider response did not include a supported image field: imageUrl, image_url, url, b64_json, base64, images[0], artifacts[0], or data[0].");
  }

  return {
    imageUrl: image.imageUrl,
    revisedPrompt: image.revisedPrompt || "",
    provider: "custom",
    requestSize: normalizeOpenAIImageSize(settings.size || settings.aspectRatio),
    createdAt: new Date().toISOString(),
    status: "success"
  };
}

async function fetchWithTimeout(url, options, timeoutMs, externalSignal = null) {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      if (externalSignal?.aborted) throw new Error("Generation cancelled");
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Check API URL, network, model support, or increase timeout.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
  }
}

function getRequestTimeoutMs(settings) {
  const seconds = Number(settings.requestTimeoutSeconds || 180);
  return Math.max(30, Math.min(seconds, 900)) * 1000;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function buildOpenAIImageBody(shot, settings) {
  const body = {
    model: settings.model || "gpt-image-1.5",
    prompt: shot.prompt,
    n: 1,
    size: normalizeOpenAIImageSize(settings.size || settings.aspectRatio),
    quality: settings.quality || "high",
    output_format: normalizeOutputFormat(settings.outputFormat || "png"),
    moderation: settings.moderation || "auto"
  };

  Object.keys(body).forEach((key) => {
    if (body[key] === "" || body[key] === undefined || body[key] === null) delete body[key];
  });
  return body;
}

function normalizeApiBaseUrl(value) {
  return String(value || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function normalizeOpenAIImageSize(size) {
  const supported = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
  if (supported.has(size)) return size;
  const ratioMap = {
    "16:9": "1536x1024",
    "3:2": "1536x1024",
    "4:3": "1536x1024",
    "9:16": "1024x1536",
    "3:4": "1024x1536",
    "2:3": "1024x1536",
    "1:1": "1024x1024"
  };
  return ratioMap[size] || "1536x1024";
}

function normalizeOutputFormat(format) {
  const normalized = String(format || "png").toLowerCase();
  if (normalized === "jpg") return "jpeg";
  return ["png", "webp", "jpeg"].includes(normalized) ? normalized : "png";
}

function extractImageResult(payload, fallbackFormat = "png") {
  const candidates = flattenImageCandidates(payload);
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") {
      const imageUrl = normalizeImageValue(candidate, fallbackFormat);
      if (imageUrl) return { imageUrl };
      continue;
    }

    const direct = candidate.imageUrl || candidate.image_url || candidate.url || candidate.uri || candidate.href;
    const b64 = candidate.b64_json || candidate.base64 || candidate.image_base64 || candidate.data;
    const imageUrl = normalizeImageValue(direct || b64, candidate.output_format || candidate.format || fallbackFormat);
    if (imageUrl) {
      return {
        imageUrl,
        revisedPrompt: candidate.revised_prompt || candidate.revisedPrompt || ""
      };
    }
  }
  return { imageUrl: "" };
}

function flattenImageCandidates(payload) {
  if (!payload || typeof payload !== "object") return [];
  const outputResults = Array.isArray(payload.output)
    ? payload.output.flatMap((item) => [item, item.result]).filter(Boolean)
    : [];
  return [
    payload,
    ...(Array.isArray(payload.data) ? payload.data : []),
    ...(Array.isArray(payload.images) ? payload.images : []),
    ...(Array.isArray(payload.artifacts) ? payload.artifacts : []),
    ...outputResults,
    payload.result,
    payload.image
  ].filter(Boolean);
}

function normalizeImageValue(value, fallbackFormat = "png") {
  if (!value) return "";
  const text = String(value).trim();
  if (/^(data:image\/|https?:\/\/|file:\/\/\/)/i.test(text)) return text;
  if (/^[A-Za-z0-9+/=\r\n]+$/.test(text) && text.length > 120) {
    return `data:image/${normalizeOutputFormat(fallbackFormat)};base64,${text.replace(/\s+/g, "")}`;
  }
  return "";
}

function readProviderError(payload, text, fallback) {
  const message = typeof payload.error === "string"
    ? payload.error
    : payload.error?.message || payload.message || payload.detail || payload.error_description;
  return message || `${fallback}: ${String(text || "").slice(0, 500)}`;
}

module.exports = {
  generateImage,
  buildOpenAIImageBody,
  extractImageResult,
  normalizeOpenAIImageSize,
  normalizeApiBaseUrl,
  normalizeOutputFormat,
  getRequestTimeoutMs
};
