const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { normalizeApiBaseUrl, getRequestTimeoutMs } = require("./provider");

function qualityCheck(shot, project = null) {
  const hasPrompt = Boolean(shot.prompt && shot.prompt.length > 120);
  const hasImage = Boolean(shot.imageUrl || shot.imagePath);
  const hasDsl = Boolean(shot.dsl?.camera && shot.dsl?.beat);
  const hasQualityRules = Array.isArray(shot.dsl?.qualityRules) && shot.dsl.qualityRules.length >= 3;
  const referencedAssetsExist = checkReferencedAssets(shot, project);
  const noFailedGeneration = shot.generationStatus !== "failed";
  const archivedImage = Boolean(shot.imagePath && fs.existsSync(shot.imagePath));
  const checks = [
    { name: "Prompt complete", passed: hasPrompt },
    { name: "Image generated", passed: hasImage },
    { name: "Director DSL complete", passed: hasDsl },
    { name: "Quality rules complete", passed: hasQualityRules },
    { name: "Referenced assets accessible", passed: referencedAssetsExist },
    { name: "Generation did not fail", passed: noFailedGeneration },
    { name: "Image archived in project asset store", passed: archivedImage }
  ];
  return buildQualityResult(checks, null);
}

async function runQualityCheck(shot, project = null, settings = {}) {
  const ruleResult = qualityCheck(shot, project);
  if (!settings.visionQualityEnabled) return ruleResult;

  const readiness = getVisionReadiness(settings);
  if (!readiness.ready) {
    return appendVisionCheck(ruleResult, {
      name: "Vision model QA",
      passed: false,
      detail: readiness.message
    });
  }

  try {
    const report = await visionQualityCheck(shot, settings, readiness.apiBaseUrl);
    return appendVisionCheck(ruleResult, {
      name: "Vision model QA",
      passed: report.passed,
      detail: report.detail,
      raw: report.raw
    });
  } catch (error) {
    return appendVisionCheck(ruleResult, {
      name: "Vision model QA",
      passed: false,
      detail: error.message
    });
  }
}

async function visionQualityCheck(shot, settings, apiBaseUrlOverride = "") {
  const imageUrl = await getVisionImageUrl(shot);
  const apiBaseUrl = normalizeApiBaseUrl(apiBaseUrlOverride || settings.apiBaseUrl || "https://api.openai.com/v1");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getRequestTimeoutMs(settings));
  try {
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: settings.visionModel || "gpt-4o-mini",
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: buildVisionPrompt(shot) },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }]
      }),
      signal: controller.signal
    });
    const text = await response.text();
    const payload = safeJson(text);
    if (!response.ok) throw new Error(readErrorMessage(payload, text, `Vision QA request failed: ${response.status}`));
    const content = payload.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);
    return {
      passed: parsed?.passed !== false,
      detail: parsed?.detail || content.slice(0, 500) || "Vision model QA completed.",
      raw: content
    };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Vision QA timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function getVisionReadiness(settings) {
  if (!settings.apiKey) {
    return { ready: false, message: "Missing API Key; vision model QA cannot run." };
  }

  const apiBaseUrl = normalizeApiBaseUrl(settings.apiBaseUrl || "");
  const defaultOpenAIUrl = normalizeApiBaseUrl("https://api.openai.com/v1");
  if (settings.provider === "custom" && (!apiBaseUrl || apiBaseUrl === defaultOpenAIUrl)) {
    return {
      ready: false,
      message: "Custom Provider generation is configured, but no OpenAI-compatible API Base URL was supplied for vision QA. Skipping remote vision request to avoid sending the key to the wrong service."
    };
  }

  return {
    ready: true,
    apiBaseUrl: apiBaseUrl || defaultOpenAIUrl
  };
}

function buildVisionPrompt(shot) {
  return [
    "You are a storyboard QA reviewer. Check whether the image matches the director DSL and prompt.",
    "Return JSON only: {\"passed\":true|false,\"detail\":\"one concise Chinese sentence\"}.",
    `Shot title: ${shot.title}`,
    `Story beat: ${shot.dsl?.beat || ""}`,
    `Camera DSL: ${JSON.stringify(shot.dsl?.camera || {})}`,
    `Prompt: ${shot.prompt || ""}`
  ].join("\n");
}

async function getVisionImageUrl(shot) {
  if (shot.imageUrl?.startsWith("data:image/")) return shot.imageUrl;
  if (shot.imagePath && fs.existsSync(shot.imagePath)) {
    const buffer = await fsp.readFile(shot.imagePath);
    return `data:${mimeFromPath(shot.imagePath)};base64,${buffer.toString("base64")}`;
  }
  if (shot.imageUrl?.startsWith("http")) return shot.imageUrl;
  throw new Error("No image is available for vision QA. Generate and archive the shot first.");
}

function appendVisionCheck(ruleResult, check) {
  const checks = [...ruleResult.checks, check];
  return buildQualityResult(checks, check.raw || null);
}

function buildQualityResult(checks, visionRaw) {
  const failed = checks.filter((item) => !item.passed).length;
  return {
    status: failed === 0 ? "passed" : failed <= 2 ? "warning" : "failed",
    checks,
    visionRaw
  };
}

function checkReferencedAssets(shot, project) {
  if (!project) return true;
  const ids = [...(shot.characterIds || []), ...(shot.sceneIds || []), ...(shot.styleIds || [])];
  if (ids.length === 0) return true;
  const assets = [...(project.assets?.characters || []), ...(project.assets?.scenes || []), ...(project.assets?.styles || [])];
  return ids.every((id) => {
    const asset = assets.find((item) => item.id === id);
    return asset?.path && fs.existsSync(asset.path);
  });
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function extractJson(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function readErrorMessage(payload, text, fallback) {
  return payload.error?.message || payload.message || payload.detail || `${fallback}: ${String(text || "").slice(0, 500)}`;
}

function mimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

module.exports = {
  qualityCheck,
  runQualityCheck,
  getVisionReadiness
};
