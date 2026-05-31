const { createShotDslFromScript } = require("./directorDsl");
const { compilePrompt, compileNegativePrompt } = require("./promptCompiler");
const { loadProjectSkill } = require("./skills");

function createInitialProject() {
  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    name: "未命名漫剧项目",
    createdAt: now,
    updatedAt: now,
    source: {
      fileName: null,
      text: ""
    },
    settings: {
      provider: "openai",
      apiKey: "",
      apiBaseUrl: "https://api.openai.com/v1",
      customEndpoint: "",
      model: "gpt-image-1.5",
      size: "1536x1024",
      aspectRatio: "16:9",
      quality: "high",
      outputFormat: "png",
      moderation: "auto",
      retryLimit: 2,
      requestTimeoutSeconds: 180,
      visionQualityEnabled: false,
      visionModel: "gpt-4o-mini",
      skillPath: "",
      outputPattern: "{project}_{index}_{title}"
    },
    assets: {
      characters: [],
      scenes: [],
      styles: []
    },
    canvas: {
      scale: 1,
      panX: 0,
      panY: 0
    },
    processLogs: [],
    shots: createDemoShots()
  };

  return project;
}

function createShotFromDsl(dsl, index, project) {
  const skill = loadProjectSkill(project?.settings || {});
  const shot = {
    id: dsl.id,
    title: `镜头 ${index + 1}`,
    dsl,
    x: 80 + (index % 3) * 420,
    y: 80 + Math.floor(index / 3) * 560,
    width: 360,
    height: 500,
    imageUrl: "",
    characterIds: [],
    sceneIds: [],
    prompt: "",
    negativePrompt: "",
    generationStatus: "idle",
    retryCount: 0,
    styleIds: [],
    quality: { status: "pending", checks: [] },
    generationLog: []
  };

  shot.prompt = compilePrompt(shot, project || { assets: { characters: [], scenes: [], styles: [] } }, skill);
  shot.negativePrompt = compileNegativePrompt(skill);
  return shot;
}

function createDemoShots() {
  const dslList = createShotDslFromScript("雨夜，女主站在便利店门口，握着一封被打湿的信。男主从街对面出现，没有立刻靠近。霓虹灯闪烁，女主终于抬头，两人的视线隔着雨幕相遇。");
  const shellProject = { assets: { characters: [], scenes: [], styles: [] } };
  return dslList.map((dsl, index) => createShotFromDsl(dsl, index, shellProject));
}

function importScriptText(project, text, fileName) {
  const next = structuredClone(project);
  next.source = { fileName, text };
  const dslList = createShotDslFromScript(text);
  next.shots = dslList.map((dsl, index) => createShotFromDsl(dsl, index, next));
  next.updatedAt = new Date().toISOString();
  return next;
}

function exportProjectBundle(project) {
  const safeProject = structuredClone(project);
  if (safeProject.settings?.apiKey) {
    safeProject.settings.apiKey = "[redacted]";
  }

  return {
    ...safeProject,
    exportedAt: new Date().toISOString(),
    archiveVersion: 1
  };
}

module.exports = {
  createInitialProject,
  importScriptText,
  exportProjectBundle
};








