const fs = require("fs");
const path = require("path");

function loadDefaultSkill() {
  const skillPath = path.join(__dirname, "../skills/manga-drama-director.json");
  return normalizeSkill(JSON.parse(fs.readFileSync(skillPath, "utf8")), skillPath, false);
}

function loadProjectSkill(settings = {}) {
  const customPath = String(settings.skillPath || "").trim();
  if (!customPath) return loadDefaultSkill();
  const resolved = path.resolve(customPath);
  const skill = JSON.parse(fs.readFileSync(resolved, "utf8"));
  return normalizeSkill(skill, resolved, true);
}

function normalizeSkill(skill, sourcePath, isThirdParty) {
  if (!skill || typeof skill !== "object") {
    throw new Error(`Skill file is not a JSON object: ${sourcePath}`);
  }
  if (!skill.promptStyle && !skill.negativePrompt && !Array.isArray(skill.shotRules)) {
    throw new Error(`Skill file does not look compatible: ${sourcePath}`);
  }
  return {
    ...skill,
    id: skill.id || path.basename(sourcePath, path.extname(sourcePath)),
    name: skill.name || "Untitled Skill",
    version: skill.version || "0.0.0",
    description: skill.description || "",
    promptStyle: skill.promptStyle || "high quality manga-drama storyboard, cinematic composition",
    negativePrompt: skill.negativePrompt || "low quality, blurry, distorted hands, extra fingers, text, watermark, inconsistent face",
    shotRules: Array.isArray(skill.shotRules) ? skill.shotRules : [],
    qualityRules: Array.isArray(skill.qualityRules) ? skill.qualityRules : [],
    providerHints: skill.providerHints || {},
    sourcePath,
    isThirdParty
  };
}

module.exports = {
  loadDefaultSkill,
  loadProjectSkill,
  normalizeSkill
};
