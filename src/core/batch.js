const { compilePrompt, compileNegativePrompt } = require("./promptCompiler");
const { loadProjectSkill } = require("./skills");
const { generateImage } = require("./provider");
const { runQualityCheck } = require("./quality");

async function runBatchGeneration(project, options = {}, onProgress = () => {}, runtime = {}) {
  const selectedIds = options.selectedShotIds?.length ? new Set(options.selectedShotIds) : null;
  const next = structuredClone(project);
  const skill = loadProjectSkill(next.settings);
  const retryLimit = Number.isFinite(Number(next.settings.retryLimit)) ? Number(next.settings.retryLimit) : 2;
  const targetShots = next.shots.filter((shot) => !(selectedIds && !selectedIds.has(shot.id)) && !(options.skipSuccessful && shot.generationStatus === "success"));
  let completed = 0;

  for (const [index, shot] of next.shots.entries()) {
    if (runtime.shouldCancel?.()) {
      onProgress({ type: "cancelled", completed, total: targetShots.length, message: "生成已取消" });
      await runtime.onCheckpoint?.(next, null, { status: "cancelled", message: "生成已取消" });
      break;
    }
    if (selectedIds && !selectedIds.has(shot.id)) continue;
    if (options.skipSuccessful && shot.generationStatus === "success") continue;

    onProgress({ type: "shot-start", shotId: shot.id, title: shot.title, completed, total: targetShots.length, message: `开始生成 ${shot.title}` });
    shot.prompt = compilePrompt(shot, next, skill);
    shot.negativePrompt = compileNegativePrompt(skill);
    shot.generationStatus = "running";
    shot.generationLog ||= [];
    shot.generationLog.push({
      id: crypto.randomUUID(),
      status: "running",
      message: "Prompt compiled and queued",
      createdAt: new Date().toISOString()
    });
    await runtime.onCheckpoint?.(next, shot, { status: "running", message: `${shot.title} 已进入生成队列` });

    for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
      try {
        onProgress({ type: "attempt", shotId: shot.id, title: shot.title, completed, total: targetShots.length, attempt: attempt + 1, message: `${shot.title} 第 ${attempt + 1} 次请求接口` });
        if (runtime.shouldCancel?.()) throw new Error("生成已取消");
        const result = await generateImage(shot, { ...next.settings, abortSignal: runtime.abortSignal });
        const archived = runtime.archiveImage ? await runtime.archiveImage(next, shot, result, index) : null;
        shot.imageUrl = archived?.imageUrl || result.imageUrl;
        shot.imagePath = archived?.imagePath || "";
        shot.metadataPath = archived?.metadataPath || "";
        shot.generatedAsset = archived?.assetRecord || null;
        shot.generationStatus = "success";
        shot.generationLog.push({
          id: crypto.randomUUID(),
          status: result.status,
          provider: result.provider,
          usage: result.usage || null,
          revisedPrompt: result.revisedPrompt || "",
          imagePath: shot.imagePath,
          metadataPath: shot.metadataPath,
          message: `Image generated and archived on attempt ${attempt + 1}`,
          createdAt: result.createdAt
        });
        shot.quality = await runQualityCheck(shot, next, next.settings);
        completed += 1;
        await runtime.onCheckpoint?.(next, shot, { status: "success", message: `${shot.title} 生成成功`, completedShotId: shot.id });
        onProgress({ type: "shot-success", shotId: shot.id, title: shot.title, completed, total: targetShots.length, imagePath: shot.imagePath, message: `${shot.title} 生成成功并已归档` });
        break;
      } catch (error) {
        shot.retryCount += 1;
        shot.generationStatus = "failed";
        shot.generationLog.push({
          id: crypto.randomUUID(),
          status: "failed",
          message: `Attempt ${attempt + 1}: ${error.message}`,
          createdAt: new Date().toISOString()
        });
        onProgress({ type: "shot-error", shotId: shot.id, title: shot.title, completed, total: targetShots.length, attempt: attempt + 1, message: error.message });

        if (attempt >= retryLimit || error.message === "生成已取消") {
          shot.quality = await runQualityCheck(shot, next, next.settings);
          completed += 1;
          await runtime.onCheckpoint?.(next, shot, { status: "failed", message: `${shot.title} 生成失败：${error.message}`, failedShotId: shot.id });
          onProgress({ type: "shot-failed", shotId: shot.id, title: shot.title, completed, total: targetShots.length, message: `${shot.title} 生成失败：${error.message}` });
          if (error.message === "生成已取消") return finish(next);
        }
      }
    }
  }

  return finish(next);
}

function finish(project) {
  project.updatedAt = new Date().toISOString();
  return project;
}

module.exports = {
  runBatchGeneration
};
