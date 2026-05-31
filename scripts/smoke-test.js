const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { createInitialProject, importScriptText, exportProjectBundle } = require("../src/core/project");
const { runBatchGeneration } = require("../src/core/batch");
const { runProductionSelfCheck } = require("../src/core/selfCheck");
const { generateImage, normalizeOpenAIImageSize, extractImageResult } = require("../src/core/provider");
const { runQualityCheck, getVisionReadiness } = require("../src/core/quality");
const { loadProjectSkill } = require("../src/core/skills");

(async () => {
  let project = createInitialProject();
  assert.ok(project.shots.length > 0, "demo project should include shots");
  assert.equal(project.settings.provider, "openai", "production default should use real provider");

  project = importScriptText(project, "女主推开门。屋内灯光忽明忽暗。她发现桌上的旧照片。", "episode-01.txt");
  assert.equal(project.shots.length, 3, "script should split into three shots");

  const thirdPartySkillPath = path.join(os.tmpdir(), "shot-factory-third-party-skill.json");
  fs.writeFileSync(thirdPartySkillPath, JSON.stringify({
    id: "third-party-style",
    name: "Third Party Style Skill",
    version: "1.0.0",
    promptStyle: "third-party neon noir storyboard style",
    negativePrompt: "third-party negative tokens",
    shotRules: ["single dramatic action"],
    qualityRules: ["style consistency", "readable composition", "no watermark"],
    modeResolver: { modes: [{ id: "single-frame" }] }
  }), "utf8");
  const thirdPartySkill = loadProjectSkill({ skillPath: thirdPartySkillPath });
  assert.equal(thirdPartySkill.isThirdParty, true, "external skill should be marked as third-party");
  assert.equal(thirdPartySkill.modeResolver.modes[0].id, "single-frame", "advanced skill fields should be preserved");
  project.settings.skillPath = thirdPartySkillPath;
  project = importScriptText(project, "她在雨中回头。", "third-party.txt");
  assert.match(project.shots[0].prompt, /third-party neon noir storyboard style/, "third-party skill should affect prompt compilation");
  assert.match(project.shots[0].prompt, /single dramatic action/, "shot rules should be included in compiled prompts");
  assert.match(project.shots[0].prompt, /style consistency/, "quality rules should be included in compiled prompts");

  project = await runBatchGeneration(project, { selectedShotIds: [project.shots[0].id] });
  assert.equal(project.shots[0].generationStatus, "failed", "missing API key should produce visible failure instead of mock success");
  assert.match(project.shots[0].generationLog.at(-1).message, /API Key/);

  const originalFetch = global.fetch;
  const fakeBase64 = Buffer.alloc(160, 7).toString("base64");
  try {
    let lastRequest = null;
    global.fetch = async (url, options) => {
      lastRequest = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ b64_json: fakeBase64, revised_prompt: "revised" }] })
      };
    };
    const openaiResult = await generateImage({ prompt: "draw a cinematic manga frame" }, {
      provider: "openai",
      apiKey: "test-key",
      apiBaseUrl: "https://example.test/v1/",
      model: "gpt-image-1.5",
      aspectRatio: "9:16",
      outputFormat: "jpg"
    });
    assert.equal(lastRequest.url, "https://example.test/v1/images/generations");
    assert.equal(lastRequest.body.size, "1024x1536");
    assert.equal(lastRequest.body.output_format, "jpeg");
    assert.ok(openaiResult.imageUrl.startsWith("data:image/jpeg;base64,"));
    assert.equal(openaiResult.revisedPrompt, "revised");

    global.fetch = async (url, options) => {
      lastRequest = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ images: [{ base64: fakeBase64, format: "webp" }] })
      };
    };
    const customResult = await generateImage({ prompt: "p", negativePrompt: "n" }, {
      provider: "custom",
      customEndpoint: "https://third-party.test/generate",
      apiKey: "third-party-key",
      model: "vendor-image",
      aspectRatio: "16:9",
      outputFormat: "webp"
    });
    assert.equal(lastRequest.url, "https://third-party.test/generate");
    assert.equal(lastRequest.body.negative_prompt, "n");
    assert.equal(lastRequest.body.output_format, "webp");
    assert.ok(customResult.imageUrl.startsWith("data:image/webp;base64,"));
  } finally {
    global.fetch = originalFetch;
  }

  project.settings.apiKey = "secret";
  assert.equal(exportProjectBundle(project).settings.apiKey, "[redacted]", "export should redact api key");

  assert.equal(normalizeOpenAIImageSize("16:9"), "1536x1024", "16:9 should map to OpenAI landscape size");
  assert.equal(normalizeOpenAIImageSize("9:16"), "1024x1536", "9:16 should map to OpenAI portrait size");
  assert.equal(extractImageResult({ image_url: "https://cdn.test/a.png" }).imageUrl, "https://cdn.test/a.png");
  assert.equal(getVisionReadiness({
    provider: "custom",
    apiKey: "third-party-key",
    apiBaseUrl: "https://api.openai.com/v1"
  }).ready, false, "custom provider should not send a third-party key to default OpenAI vision QA");

  const qa = await runQualityCheck({
    prompt: "x".repeat(140),
    imageUrl: "data:image/png;base64," + Buffer.alloc(160, 1).toString("base64"),
    imagePath: "",
    dsl: { beat: "beat", camera: {}, qualityRules: ["a", "b", "c"] },
    generationStatus: "success",
    characterIds: [],
    sceneIds: [],
    styleIds: []
  }, project, {
    provider: "custom",
    apiKey: "third-party-key",
    apiBaseUrl: "https://api.openai.com/v1",
    visionQualityEnabled: true
  });
  assert.equal(qa.checks.at(-1).name, "Vision model QA");
  assert.match(qa.checks.at(-1).detail, /wrong service/);
  assert.ok(runProductionSelfCheck(project).findings.length > 0, "self check should produce findings");

  console.log("smoke-test passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
