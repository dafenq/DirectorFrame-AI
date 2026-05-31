const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const { createInitialProject, importScriptText, exportProjectBundle } = require("../core/project");
const { runBatchGeneration } = require("../core/batch");
const { runProductionSelfCheck } = require("../core/selfCheck");
const { archiveImportedAsset, archiveGeneratedImage } = require("../core/assetStore");
const { createGenerationJob, updateGenerationJob, finishGenerationJob, listRecoverableJobs, markRunningJobsInterrupted } = require("../core/jobQueue");

let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch {
  autoUpdater = null;
}

let mainWindow;
let project = createInitialProject();
let currentProjectPath = null;
let activeGeneration = null;
let recoverableJobs = [];

function appendProcessLog(level, message, detail = "") {
  project.processLogs ||= [];
  project.processLogs.unshift({
    id: crypto.randomUUID(),
    level,
    message,
    detail,
    createdAt: new Date().toISOString()
  });
  project.processLogs = project.processLogs.slice(0, 300);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#101114",
    icon: path.join(__dirname, "../../build/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(async () => {
  createWindow();
  configureAutoUpdates();
  await refreshRecoverableJobs();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("project:get", () => project);

ipcMain.handle("project:new", async () => {
  project = createInitialProject();
  currentProjectPath = null;
  recoverableJobs = [];
  return project;
});

ipcMain.handle("project:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "打开分镜项目",
    filters: [{ name: "Shot Factory Project", extensions: ["shotfactory.json", "json"] }],
    properties: ["openFile"]
  });

  if (result.canceled || !result.filePaths[0]) return { project, filePath: currentProjectPath };
  const text = await fs.readFile(result.filePaths[0], "utf8");
  project = JSON.parse(text);
  currentProjectPath = result.filePaths[0];
  await refreshRecoverableJobs(true);
  return { project, filePath: currentProjectPath };
});

ipcMain.handle("project:importScript", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "导入小说或剧本",
    filters: [{ name: "Text", extensions: ["txt", "md"] }],
    properties: ["openFile"]
  });

  if (result.canceled || !result.filePaths[0]) return project;
  const text = await fs.readFile(result.filePaths[0], "utf8");
  project = importScriptText(project, text, path.basename(result.filePaths[0]));
  await saveProjectSnapshot();
  return project;
});

ipcMain.handle("assets:import", async (_event, kind) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: kind === "character" ? "导入角色资产" : kind === "scene" ? "导入场景资产" : "导入风格参考图",
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    properties: ["openFile", "multiSelections"]
  });

  if (result.canceled) return project;
  const target = kind === "character" ? project.assets.characters : kind === "scene" ? project.assets.scenes : project.assets.styles;
  let imported = 0;
  for (const filePath of result.filePaths) {
    try {
      target.push(await archiveImportedAsset(project, filePath, kind, target.length, getRuntimeContext()));
      imported += 1;
    } catch (error) {
      appendProcessLog("error", "图片导入失败", `${filePath}: ${error.message}`);
    }
  }
  appendProcessLog(imported ? "success" : "error", "图片导入完成", `${imported}/${result.filePaths.length} 个${kind === "character" ? "角色" : kind === "scene" ? "场景" : "风格"}参考已复制到项目资产库`);
  await saveProjectSnapshot();
  return project;
});

ipcMain.handle("project:update", async (_event, nextProject) => {
  project = nextProject;
  await saveProjectSnapshot();
  return project;
});

ipcMain.handle("project:save", async (_event, saveAs = false) => saveProject(saveAs));

ipcMain.handle("batch:generate", async (_event, options) => runGeneration(options));

ipcMain.handle("batch:resume", async () => {
  await refreshRecoverableJobs();
  const job = recoverableJobs[0];
  if (!job) return { project, resumed: false, message: "没有可恢复的未完成任务" };
  appendProcessLog("info", "恢复未完成任务", `${job.pendingShotIds.length} 个镜头将继续生成`);
  const options = { ...(job.options || {}), selectedShotIds: job.pendingShotIds, skipSuccessful: true };
  const nextProject = await runGeneration(options, job);
  return { project: nextProject, resumed: true, message: "已恢复未完成任务" };
});

ipcMain.handle("batch:cancel", async () => {
  if (!activeGeneration) return { cancelled: false, message: "当前没有正在运行的生成进程" };
  activeGeneration.cancelled = true;
  activeGeneration.controller.abort();
  appendProcessLog("warning", "用户取消生成", "当前生成请求已发送取消信号，任务队列保留未完成镜头。可稍后恢复。");
  if (activeGeneration.job) await finishGenerationJob(activeGeneration.job, "interrupted", "用户取消生成，可恢复未完成镜头");
  await saveProjectSnapshot();
  mainWindow?.webContents.send("batch:progress", { type: "cancelled", message: "用户取消生成" });
  return { cancelled: true };
});

ipcMain.handle("project:selfCheck", () => runProductionSelfCheck(project, {
  projectPath: currentProjectPath,
  userDataPath: app.getPath("userData"),
  appRoot: path.join(__dirname, "../.."),
  autoUpdaterAvailable: Boolean(autoUpdater),
  updateUrl: process.env.SHOT_FACTORY_UPDATE_URL || ""
}));

ipcMain.handle("project:export", async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "导出项目归档",
    defaultPath: `${project.name || "storyboard-project"}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, JSON.stringify(exportProjectBundle(project), null, 2), "utf8");
  return result.filePath;
});

ipcMain.handle("app:checkUpdates", async () => {
  if (!autoUpdater) return { ok: false, message: "当前安装包未包含 electron-updater，无法自动更新。" };
  if (!process.env.SHOT_FACTORY_UPDATE_URL) return { ok: false, message: "未设置 SHOT_FACTORY_UPDATE_URL，无法检查更新。" };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, message: result?.updateInfo ? `发现版本信息：${result.updateInfo.version}` : "已完成更新检查" };
  } catch (error) {
    appendProcessLog("error", "更新检查失败", error.message);
    return { ok: false, message: error.message };
  }
});

async function runGeneration(options = {}, existingJob = null) {
  if (activeGeneration) throw new Error("已有生成任务正在运行，请先取消或等待完成。");
  appendProcessLog("info", options?.selectedShotIds?.length ? "开始生成当前/恢复镜头" : "开始批量生成", `Provider: ${project.settings.provider}; API: ${project.settings.apiBaseUrl || project.settings.customEndpoint || "未设置地址"}`);
  let job = existingJob || await createGenerationJob(project, options, getRuntimeContext());
  try {
    activeGeneration = { controller: new AbortController(), cancelled: false, job };
    await updateGenerationJob(job, { status: "running", lastMessage: "生成任务运行中" });
    project = await runBatchGeneration(project, options, (progress) => {
      mainWindow?.webContents.send("batch:progress", progress);
      if (progress.message) updateGenerationJob(job, { lastMessage: progress.message }).catch(() => {});
    }, {
      abortSignal: activeGeneration.controller.signal,
      shouldCancel: () => activeGeneration?.cancelled === true,
      archiveImage: (snapshot, shot, result, index) => archiveGeneratedImage(snapshot, shot, result, { ...getRuntimeContext(), settings: snapshot.settings, index }),
      onCheckpoint: async (snapshot, shot, state) => {
        project = structuredClone(snapshot);
        if (state?.completedShotId) await updateGenerationJob(job, { completedShotId: state.completedShotId, lastMessage: state.message });
        if (state?.failedShotId) await updateGenerationJob(job, { failedShotId: state.failedShotId, lastMessage: state.message });
        if (state?.status === "cancelled") await finishGenerationJob(job, "interrupted", state.message);
        await saveProjectSnapshot();
      }
    });
    const selected = options?.selectedShotIds?.length ? new Set(options.selectedShotIds) : null;
    const shots = selected ? project.shots.filter((shot) => selected.has(shot.id)) : project.shots;
    const failed = shots.filter((shot) => shot.generationStatus === "failed");
    if (failed.length) {
      await finishGenerationJob(job, "finished-with-errors", `${failed.length} 个镜头失败`);
      appendProcessLog("error", "生成完成但有失败镜头", failed.map((shot) => `${shot.title}: ${shot.generationLog.at(-1)?.message || "未知错误"}`).join("\n"));
    } else {
      await finishGenerationJob(job, "completed", `${shots.length} 个镜头已生成并归档`);
      appendProcessLog("success", "生成完成", `${shots.length} 个镜头已生成并归档`);
    }
    await saveProjectSnapshot();
    return project;
  } catch (error) {
    if (job) await finishGenerationJob(job, "interrupted", error.message);
    appendProcessLog("error", "生成进程异常", error.message);
    await saveProjectSnapshot();
    throw error;
  } finally {
    activeGeneration = null;
    await refreshRecoverableJobs();
  }
}

async function saveProject(saveAs = false) {
  if (saveAs || !currentProjectPath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "保存分镜项目",
      defaultPath: `${project.name || "storyboard-project"}.shotfactory.json`,
      filters: [{ name: "Shot Factory Project", extensions: ["shotfactory.json", "json"] }]
    });

    if (result.canceled || !result.filePath) return { project, filePath: currentProjectPath, saved: false };
    currentProjectPath = result.filePath;
  }

  await saveProjectSnapshot(true);
  return { project, filePath: currentProjectPath, saved: true };
}

async function saveProjectSnapshot(force = false) {
  if (!currentProjectPath && !force) return;
  if (!currentProjectPath) return;
  project.updatedAt = new Date().toISOString();
  await fs.writeFile(currentProjectPath, JSON.stringify(project, null, 2), "utf8");
}

async function refreshRecoverableJobs(markInterrupted = false) {
  const context = getRuntimeContext();
  recoverableJobs = markInterrupted
    ? await markRunningJobsInterrupted(project, context)
    : await listRecoverableJobs(project, context);
  if (recoverableJobs.length) {
    appendProcessLog("warning", "发现未完成任务", `${recoverableJobs[0].pendingShotIds.length} 个镜头可恢复。点击“恢复任务”继续。`);
  }
  return recoverableJobs;
}

function getRuntimeContext() {
  return {
    projectPath: currentProjectPath,
    userDataPath: app.getPath("userData")
  };
}

function configureAutoUpdates() {
  if (!autoUpdater) {
    appendProcessLog("warning", "自动更新未启用", "需要安装 electron-updater 依赖后重新打包。配置已预留。 ");
    return;
  }
  const updateUrl = process.env.SHOT_FACTORY_UPDATE_URL;
  if (!updateUrl) {
    appendProcessLog("warning", "自动更新未配置", "设置 SHOT_FACTORY_UPDATE_URL 后可连接 generic 更新源。 ");
    return;
  }
  autoUpdater.autoDownload = false;
  autoUpdater.setFeedURL({ provider: "generic", url: updateUrl });
  autoUpdater.on("update-available", (info) => appendProcessLog("success", "发现新版本", info.version || "有可用更新"));
  autoUpdater.on("update-not-available", () => appendProcessLog("info", "当前已是最新版本"));
  autoUpdater.on("error", (error) => appendProcessLog("error", "自动更新错误", error.message));
}
