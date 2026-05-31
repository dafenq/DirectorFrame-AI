function formatAssetList(items) {
  if (!items || items.length === 0) return "未绑定";
  return items.map((item) => item.name).join(", ");
}

function compilePrompt(shot, project, skill) {
  const characterNames = formatAssetList((shot.characterIds || []).map((id) => project.assets.characters.find((item) => item.id === id)).filter(Boolean));
  const sceneNames = formatAssetList((shot.sceneIds || []).map((id) => project.assets.scenes.find((item) => item.id === id)).filter(Boolean));
  const styleAssets = shot.styleIds?.length
    ? shot.styleIds.map((id) => project.assets.styles.find((item) => item.id === id)).filter(Boolean)
    : project.assets.styles;
  const styleNames = formatAssetList(styleAssets);
  const styleText = skill?.promptStyle || "high quality manga-drama storyboard, cinematic composition";
  const skillDirection = formatRuleList(skill?.shotRules);
  const qualityBar = formatRuleList(skill?.qualityRules);

  return [
    styleText,
    skillDirection ? `storyboard direction rules: ${skillDirection}` : "",
    qualityBar ? `quality bar: ${qualityBar}` : "",
    `story beat: ${shot.dsl.beat}`,
    `characters: ${characterNames}`,
    `scene: ${sceneNames}`,
    `camera: ${cameraPrompt(shot.dsl)}`,
    `target aspect ratio: ${project.settings?.aspectRatio || project.settings?.size || "16:9"}, compose for this final frame ratio`,
    `composition: ${shot.dsl.composition?.prompt || shot.dsl.composition?.label || "clean cinematic composition"}`,
    `lighting: ${shot.dsl.lighting?.prompt || shot.dsl.lighting?.label || "cinematic lighting"}`,
    `rhythm: ${shot.dsl.rhythm?.prompt || shot.dsl.rhythm?.label || "clear dramatic beat"}`,
    `transition intent: ${shot.dsl.transition?.prompt || shot.dsl.transition?.label || "hard cut transition"}`,
    `blocking: ${shot.dsl.blocking}`,
    `performance: ${shot.dsl.performance || "expressive but controlled acting"}`,
    `emotion: ${shot.dsl.emotion}`,
    `continuity: ${shot.dsl.continuity}`,
    `style references: ${styleNames}`,
    "clean composition, expressive faces, consistent costumes, no watermark, no captions"
  ].filter(Boolean).join("\n");
}

function formatRuleList(rules) {
  if (!Array.isArray(rules) || rules.length === 0) return "";
  return rules
    .map((rule) => String(rule || "").trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(" | ");
}

function cameraPrompt(dsl) {
  if (dsl.camera?.prompt) return dsl.camera.prompt;
  return [dsl.camera?.angle, dsl.camera?.lens, dsl.camera?.movement].filter(Boolean).join(", ");
}

function compileNegativePrompt(skill) {
  return skill?.negativePrompt || "low quality, blurry, distorted hands, extra fingers, text, watermark, inconsistent face";
}

module.exports = {
  compilePrompt,
  compileNegativePrompt
};
