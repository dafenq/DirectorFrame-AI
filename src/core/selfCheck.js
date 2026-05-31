const fs = require("fs");
const path = require("path");
const { loadProjectSkill } = require("./skills");

function runProductionSelfCheck(project, context = {}) {
  const findings = [];
  const skill = safeLoadSkill(findings, project);

  addFinding(findings, {
    id: "provider",
    severity: project.settings.provider === "openai" || project.settings.provider === "custom" ? "ok" : "blocker",
    title: "真实生图 Provider",
    detail: project.settings.provider === "openai" || project.settings.provider === "custom"
      ? `当前 provider 为 ${project.settings.provider}，会调用真实生图服务。`
      : `当前 provider 为 ${project.settings.provider || "未设置"}，不能用于真实生产。`
  });

  addFinding(findings, {
    id: "api-endpoint",
    severity: hasUsableEndpoint(project.settings) ? "ok" : "blocker",
    title: "API 地址",
    detail: hasUsableEndpoint(project.settings)
      ? `已配置 ${project.settings.provider === "custom" ? "自定义 Endpoint" : "API Base URL"}。`
      : "缺少 API Base URL 或自定义 Endpoint，真实平台无法发起请求。"
  });

  const timeoutSeconds = Number(project.settings.requestTimeoutSeconds || 0);
  addFinding(findings, {
    id: "request-timeout",
    severity: timeoutSeconds >= 30 && timeoutSeconds <= 900 ? "ok" : "warning",
    title: "请求超时",
    detail: timeoutSeconds
      ? `当前单次请求超时为 ${timeoutSeconds} 秒，生成过久时会返回错误并写入日志。`
      : "未设置请求超时；生成卡住时用户会缺少明确反馈。"
  });

  addFinding(findings, {
    id: "api-key",
    severity: !project.settings.apiKey ? "blocker" : "warning",
    title: "API Key 管理",
    detail: project.settings.apiKey
      ? "已配置 API Key，但目前仍保存在项目文件中；正式商用建议接入 Windows Credential Manager。"
      : "未配置 API Key；真实平台不可生成。"
  });

  addFinding(findings, {
    id: "asset-store",
    severity: hasArchivedImages(project) ? "ok" : "warning",
    title: "项目资产库",
    detail: hasArchivedImages(project)
      ? "生成图片已保存为项目资产库中的图片文件，并带元数据 JSON。"
      : "尚未发现已归档生成图；真实生成成功后会写入项目资产库。"
  });

  addFinding(findings, {
    id: "queue-recovery",
    severity: "ok",
    title: "任务队列恢复",
    detail: "批量生成任务会写入 queue 文件；每个镜头完成后保存检查点，应用中断后可点击恢复任务继续。"
  });

  addFinding(findings, {
    id: "vision-qa",
    severity: project.settings.visionQualityEnabled ? "ok" : "warning",
    title: "视觉模型质检",
    detail: project.settings.visionQualityEnabled
      ? `已开启视觉质检，模型：${project.settings.visionModel || "未设置"}。`
      : "当前只运行规则质检；开启视觉质检后会调用视觉模型检查图片和 DSL/Prompt 是否一致。"
  });

  addFinding(findings, {
    id: "app-icon",
    severity: context.appRoot && fs.existsSync(path.join(context.appRoot, "build", "icon.ico")) ? "ok" : "warning",
    title: "应用图标",
    detail: context.appRoot && fs.existsSync(path.join(context.appRoot, "build", "icon.ico"))
      ? "已配置 Windows 安装包图标。"
      : "未找到 build/icon.ico，安装包仍会使用默认图标。"
  });

  addFinding(findings, {
    id: "code-signing",
    severity: process.env.WIN_CSC_LINK || process.env.CSC_LINK ? "ok" : "warning",
    title: "安装包签名",
    detail: process.env.WIN_CSC_LINK || process.env.CSC_LINK
      ? "检测到签名证书环境变量，打包时可签名。"
      : "未检测到签名证书。已预留 electron-builder 签名配置，但正式发布必须提供代码签名证书。"
  });

  addFinding(findings, {
    id: "auto-update",
    severity: context.autoUpdaterAvailable && context.updateUrl ? "ok" : "warning",
    title: "自动更新",
    detail: context.autoUpdaterAvailable && context.updateUrl
      ? "electron-updater 已启用并配置更新地址。"
      : "已预留自动更新入口；需要安装 electron-updater 并设置 SHOT_FACTORY_UPDATE_URL 才能连接更新源。"
  });

  addFinding(findings, {
    id: "shots",
    severity: project.shots.length > 0 ? "ok" : "blocker",
    title: "镜头数量",
    detail: `当前项目有 ${project.shots.length} 个镜头。`
  });

  const invalidDsl = project.shots.filter((shot) => !shot.dsl?.beat || !shot.dsl?.camera || !shot.prompt);
  addFinding(findings, {
    id: "dsl",
    severity: invalidDsl.length ? "blocker" : "ok",
    title: "DSL / Prompt 完整性",
    detail: invalidDsl.length ? `${invalidDsl.length} 个镜头缺少 DSL 或 Prompt。` : "所有镜头都有基础 DSL 和 Prompt。"
  });

  const missingAssets = findMissingAssets(project);
  addFinding(findings, {
    id: "assets",
    severity: missingAssets.length ? "warning" : "ok",
    title: "资产可访问性",
    detail: missingAssets.length ? `${missingAssets.length} 个资产路径不可访问。` : "已导入资产路径当前可访问，或项目尚未绑定外部资产。"
  });

  addFinding(findings, {
    id: "skill",
    severity: skill ? "ok" : "blocker",
    title: "Skill 可加载",
    detail: skill ? `已加载 ${skill.name} v${skill.version}。` : "默认 skill 无法加载。"
  });

  const generated = project.shots.filter((shot) => shot.generationStatus === "success").length;
  const failed = project.shots.filter((shot) => shot.generationStatus === "failed").length;
  addFinding(findings, {
    id: "generation-status",
    severity: failed ? "warning" : generated ? "ok" : "warning",
    title: "生成状态",
    detail: `已生成 ${generated} 个，失败 ${failed} 个。`
  });

  const blockers = findings.filter((item) => item.severity === "blocker").length;
  const warnings = findings.filter((item) => item.severity === "warning").length;

  return {
    ready: blockers === 0,
    level: blockers ? "not-ready" : warnings ? "pilot-ready" : "production-ready",
    blockers,
    warnings,
    findings,
    checkedAt: new Date().toISOString()
  };
}

function addFinding(findings, finding) {
  findings.push(finding);
}

function safeLoadSkill(findings, project = {}) {
  try {
    return loadProjectSkill(project.settings || {});
  } catch (error) {
    findings.push({
      id: "skill-load-error",
      severity: "blocker",
      title: "Skill 加载失败",
      detail: error.message
    });
    return null;
  }
}

function findMissingAssets(project) {
  const allAssets = [
    ...(project.assets?.characters || []),
    ...(project.assets?.scenes || []),
    ...(project.assets?.styles || [])
  ];
  return allAssets.filter((asset) => asset.path && !fs.existsSync(asset.path));
}

function hasUsableEndpoint(settings) {
  if (settings.provider === "custom") return Boolean(settings.customEndpoint);
  if (settings.provider === "openai") return Boolean(settings.apiBaseUrl);
  return false;
}

function hasArchivedImages(project) {
  return project.shots.some((shot) => shot.imagePath && fs.existsSync(shot.imagePath) && shot.metadataPath && fs.existsSync(shot.metadataPath));
}

module.exports = {
  runProductionSelfCheck
};
