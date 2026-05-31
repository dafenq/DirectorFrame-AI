let project;
let selectedShotId = null;
let dragState = null;
let currentProjectPath = null;
let saveTimer = null;
let compactView = false;
let panState = null;
let assetDragState = null;
let generationStartedAt = null;
let generationTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const canvas = $("#canvas");
const viewport = $("#canvasViewport");

const CINEMA_LANGUAGE = {
  shotSizes: {
    title: "景别",
    target: "camera",
    items: [
      ["ECU", "大特写", "extreme close-up, tiny facial detail, intense emotional focus"],
      ["CU", "特写", "close-up shot, expressive face, shallow depth of field"],
      ["MCU", "中近景", "medium close-up, upper body acting, readable emotion"],
      ["MS", "中景", "medium shot, body language and dialogue staging"],
      ["MLS", "中远景", "medium long shot, character and environment relationship"],
      ["WS", "远景", "wide shot, full body in the scene, spatial context"],
      ["EWS", "大远景", "extreme wide shot, environment dominates the frame"],
      ["OTS", "过肩", "over-the-shoulder shot, dialogue tension and eyeline match"]
    ]
  },
  angles: {
    title: "机位",
    target: "camera",
    items: [
      ["eye_level", "平视", "eye-level camera, natural perspective"],
      ["low_angle", "仰拍", "low angle, character appears powerful or threatening"],
      ["high_angle", "俯拍", "high angle, character appears vulnerable or observed"],
      ["dutch_angle", "倾斜", "dutch angle, unstable psychological tension"],
      ["top_down", "顶拍", "top-down shot, graphic composition and spatial clarity"],
      ["profile", "侧面", "profile angle, clear silhouette and emotional restraint"],
      ["back_view", "背影", "back view, withheld emotion, atmospheric storytelling"],
      ["pov", "主观", "POV shot, subjective viewpoint and immediate immersion"]
    ]
  },
  movements: {
    title: "运动",
    target: "camera",
    items: [
      ["static", "静态", "locked-off camera, still composition"],
      ["push_in", "推镜", "slow push-in, rising emotional pressure"],
      ["pull_out", "拉远", "slow pull-out, emotional distance and isolation"],
      ["tracking", "跟拍", "tracking shot, following character movement"],
      ["pan", "摇镜", "pan camera movement, revealing new information"],
      ["tilt", "俯仰", "tilt camera movement, vertical reveal"],
      ["handheld", "手持", "subtle handheld camera, documentary immediacy"],
      ["crash_zoom", "急推", "crash zoom, sudden realization and dramatic shock"]
    ]
  },
  lenses: {
    title: "焦段",
    target: "camera",
    items: [
      ["24mm", "24mm", "24mm wide lens, strong spatial depth"],
      ["35mm", "35mm", "35mm cinematic lens, balanced subject and environment"],
      ["50mm", "50mm", "50mm natural perspective, intimate realism"],
      ["85mm", "85mm", "85mm portrait lens, compressed background, soft bokeh"],
      ["135mm", "135mm", "135mm telephoto lens, compressed space and observation"],
      ["macro", "微距", "macro lens, tactile detail and symbolic object focus"]
    ]
  },
  compositions: {
    title: "构图",
    target: "composition",
    items: [
      ["rule_of_thirds", "三分法", "rule of thirds composition, clean visual hierarchy"],
      ["centered", "中心", "centered composition, iconic and direct framing"],
      ["symmetry", "对称", "symmetrical composition, ritualistic visual order"],
      ["negative_space", "留白", "negative space, isolation and emotional pressure"],
      ["frame_within_frame", "框中框", "frame within frame, trapped feeling"],
      ["leading_lines", "引导线", "leading lines guiding attention to the subject"],
      ["foreground_occlusion", "前景遮挡", "foreground occlusion, voyeuristic depth"],
      ["silhouette", "剪影", "silhouette composition, strong graphic emotion"]
    ]
  },
  lighting: {
    title: "光影",
    target: "lighting",
    items: [
      ["soft_key", "柔主光", "soft key light, gentle skin tone and readable emotion"],
      ["hard_light", "硬光", "hard light, sharp contrast and dramatic shadows"],
      ["rim_light", "轮廓光", "rim light, separated silhouette and cinematic edge"],
      ["backlit", "逆光", "backlit scene, glowing atmosphere and mystery"],
      ["low_key", "低调光", "low-key lighting, noir contrast and suspense"],
      ["high_key", "高调光", "high-key lighting, clean bright dramatic clarity"],
      ["neon", "霓虹", "neon practical lights, urban night color contrast"],
      ["volumetric", "体积光", "volumetric light, visible beams and atmospheric depth"]
    ]
  },
  rhythms: {
    title: "节奏",
    target: "rhythm",
    items: [
      ["hold", "长停顿", "held moment, quiet tension before action"],
      ["snap", "短促", "quick visual beat, sharp dramatic punctuation"],
      ["slow_burn", "慢燃", "slow-burn pacing, emotion accumulates gradually"],
      ["reveal", "揭示", "reveal beat, new information enters the frame"],
      ["impact", "冲击", "impact beat, strong emotional punctuation"],
      ["breath", "喘息", "breathing beat, brief release after tension"]
    ]
  },
  transitions: {
    title: "转场",
    target: "transition",
    items: [
      ["cut", "硬切", "hard cut transition"],
      ["match_cut", "匹配", "match cut, visual continuity between shots"],
      ["jump_cut", "跳切", "jump cut, compressed time and agitation"],
      ["fade", "淡入淡出", "fade transition, lyrical time passage"],
      ["whip_pan", "甩镜", "whip pan transition, fast energy and surprise"],
      ["insert", "插入", "insert shot transition to a meaningful object detail"]
    ]
  },
  emotions: {
    title: "情绪",
    target: "emotion",
    items: [
      ["tension", "紧张", "tense atmosphere, restrained body language"],
      ["oppression", "压迫", "oppressive mood, heavy negative space and low-key light"],
      ["suspense", "悬疑", "suspenseful mood, partial reveal and uncertain eyeline"],
      ["intimacy", "亲密", "intimate mood, soft light and close physical distance"],
      ["lonely", "孤独", "lonely mood, wide framing and emotional distance"],
      ["anger", "爆发", "explosive anger, hard contrast and sharp posture"],
      ["relief", "松弛", "relief after tension, warmer light and open posture"],
      ["shock", "震惊", "shock, frozen expression and sudden visual emphasis"]
    ]
  }
};

function normalizeProjectSettings() {
  project.settings ||= {};
  if (project.settings.provider === "mock") project.settings.provider = "openai";
  project.settings.provider ||= "openai";
  project.settings.apiBaseUrl ||= "https://api.openai.com/v1";
  project.settings.aspectRatio = normalizeAspectValue(project.settings.aspectRatio || project.settings.size || "16:9");
  project.settings.size = project.settings.aspectRatio;
  project.processLogs ||= [];
  project.settings.visionQualityEnabled ??= false;
  project.settings.visionModel ||= "gpt-4o-mini";
  project.settings.skillPath ||= "";
}

function normalizeAspectValue(value) {
  const valid = new Set(["16:9", "9:16", "3:4", "4:3", "1:1", "3:2", "2:3", "auto"]);
  if (valid.has(value)) return value;
  if (value === "1024x1536") return "9:16";
  if (value === "1024x1024") return "1:1";
  return "16:9";
}

function beginGenerationProgress() {
  generationStartedAt = Date.now();
  const box = $("#generationProgress");
  if (box) box.hidden = false;
  updateGenerationProgress({ completed: 0, total: 1, message: "正在提交生成请求" });
  window.clearInterval(generationTimer);
  generationTimer = window.setInterval(() => {
    updateElapsed();
  }, 1000);
}

function endGenerationProgress() {
  updateElapsed();
  window.clearInterval(generationTimer);
  generationTimer = null;
}

function handleBatchProgress(progress) {
  const shot = project.shots?.find((item) => item.id === progress.shotId);
  if (shot) {
    if (progress.type === "shot-start" || progress.type === "attempt") shot.generationStatus = "running";
    if (progress.type === "shot-success") shot.generationStatus = "success";
    if (progress.type === "shot-failed") shot.generationStatus = "failed";
  }
  updateGenerationProgress(progress);
  renderHeader();
  renderInspector();
  const level = progress.type?.includes("error") || progress.type?.includes("failed") ? "error" : progress.type?.includes("success") ? "success" : "info";
  showFeedback(level, progress.message || "生成进程更新", progress.total ? `${progress.completed}/${progress.total}` : "");
}

function updateGenerationProgress(progress) {
  const bar = $("#progressBar");
  const text = $("#progressText");
  if (bar) {
    bar.max = Math.max(progress.total || 1, 1);
    bar.value = Math.min(progress.completed || 0, bar.max);
  }
  if (text) text.textContent = progress.message || "生成中";
  updateElapsed();
}

function updateElapsed() {
  const elapsed = $("#progressElapsed");
  if (!elapsed || !generationStartedAt) return;
  const seconds = Math.floor((Date.now() - generationStartedAt) / 1000);
  elapsed.textContent = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
async function init() {
  project = await window.shotFactory.getProject();
  selectedShotId ||= project.shots?.[0]?.id || null;
  window.shotFactory.onBatchProgress?.(handleBatchProgress);
  bindEvents();
  render();
}

function bindEvents() {
  $("#newProjectBtn").addEventListener("click", async () => {
    project = await window.shotFactory.newProject();
    currentProjectPath = null;
    selectedShotId = null;
    render();
  });

  $("#openProjectBtn").addEventListener("click", async () => {
    const result = await window.shotFactory.openProject();
    project = result.project;
    currentProjectPath = result.filePath;
    selectedShotId = project.shots[0]?.id || null;
    render();
  });

  $("#saveProjectBtn").addEventListener("click", async () => saveProject(true));

  $("#importScriptBtn").addEventListener("click", async () => {
    project = await window.shotFactory.importScript();
    selectedShotId = project.shots[0]?.id || null;
    render();
  });

  document.querySelectorAll("[data-import]").forEach((button) => {
    button.addEventListener("click", async () => {
      project = await window.shotFactory.importAssets(button.dataset.import);
      render();
    });
  });

  $("#generateBtn").addEventListener("click", async () => {
    await generateShots({ skipSuccessful: false });
  });

  $("#generateShotBtn")?.addEventListener("click", async () => {
    const shot = getSelectedShot();
    if (!shot) return;
    await generateShots({ selectedShotIds: [shot.id], skipSuccessful: false });
  });

  $("#selfCheckBtn").addEventListener("click", runSelfCheck);

  $("#cancelGenerateBtn")?.addEventListener("click", async () => {
    const result = await window.shotFactory.cancelBatch?.();
    showFeedback(result?.cancelled ? "warning" : "info", result?.message || "已请求取消生成");
  });

  $("#resumeBatchBtn")?.addEventListener("click", async () => {
    setBusy(true);
    try {
      beginGenerationProgress();
      const result = await window.shotFactory.resumeBatch?.();
      project = result?.project || project;
      showFeedback(result?.resumed ? "success" : "info", result?.message || "恢复任务已执行");
      render();
    } catch (error) {
      showFeedback("error", "恢复任务失败", error.message);
    } finally {
      endGenerationProgress();
      setBusy(false);
    }
  });

  $("#checkUpdateBtn")?.addEventListener("click", async () => {
    const result = await window.shotFactory.checkUpdates?.();
    showFeedback(result?.ok ? "success" : "warning", "更新检查", result?.message || "没有返回更新信息");
  });

  $("#exportBtn").addEventListener("click", async () => {
    await syncProject();
    const filePath = await window.shotFactory.exportProject();
    if (filePath) $("#projectMeta").textContent = `已导出：${filePath}`;
  });

  $("#zoomInBtn").addEventListener("click", () => zoomBy(0.1));
  $("#zoomOutBtn").addEventListener("click", () => zoomBy(-0.1));
  $("#viewBoardBtn").addEventListener("click", () => setCompactView(false));
  $("#viewCompactBtn").addEventListener("click", () => setCompactView(true));

  viewport.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -0.05 : 0.05);
  }, { passive: false });

  viewport.addEventListener("pointerdown", startPan);

  $$(".inspector-tabs button").forEach((button) => {
    button.addEventListener("click", () => setInspectorTab(button.dataset.tab));
  });

  bindProjectSettings();
  bindInspector();
}

function bindProjectSettings() {
  ["projectName", "provider", "apiKey", "apiBaseUrl", "customEndpoint", "skillPath", "model", "size", "quality", "outputFormat", "moderation", "retryLimit", "requestTimeoutSeconds", "visionQualityEnabled", "visionModel"].forEach((id) => {
    $(`#${id}`).addEventListener("change", async () => {
      project.name = $("#projectName").value;
      project.settings.provider = $("#provider").value;
      project.settings.apiKey = $("#apiKey").value;
      project.settings.apiBaseUrl = $("#apiBaseUrl").value;
      project.settings.customEndpoint = $("#customEndpoint").value;
      project.settings.skillPath = $("#skillPath").value;
      project.settings.model = $("#model").value;
      project.settings.size = $("#size").value;
      project.settings.aspectRatio = $("#size").value;
      project.settings.quality = $("#quality").value;
      project.settings.outputFormat = $("#outputFormat").value;
      project.settings.moderation = $("#moderation").value;
      project.settings.retryLimit = Number($("#retryLimit").value);
      project.settings.requestTimeoutSeconds = Number($("#requestTimeoutSeconds").value);
      project.settings.visionQualityEnabled = $("#visionQualityEnabled").value === "true";
      project.settings.visionModel = $("#visionModel").value;
      await syncProject();
      renderHeader();
      updateProviderHint();
    });
  });
}

function bindInspector() {
  $("#shotTitle").addEventListener("change", updateSelectedShotFromInspector);
  $("#shotBeat").addEventListener("change", updateSelectedShotFromInspector);
  $("#shotBlocking").addEventListener("change", updateSelectedShotFromInspector);
  $("#shotPrompt").addEventListener("change", updateSelectedShotFromInspector);
  $("#negativePrompt").addEventListener("change", updateSelectedShotFromInspector);
  $("#shotDsl").addEventListener("change", updateSelectedShotFromInspector);
}

async function updateSelectedShotFromInspector() {
  const shot = getSelectedShot();
  if (!shot) return;
  shot.title = $("#shotTitle").value;
  shot.prompt = $("#shotPrompt").value;
  shot.negativePrompt = $("#negativePrompt").value;
  try {
    shot.dsl = JSON.parse($("#shotDsl").value);
  } catch {
    $("#shotDsl").style.borderColor = "var(--danger)";
    return;
  }
  shot.dsl.beat = $("#shotBeat").value;
  shot.dsl.blocking = $("#shotBlocking").value;
  $("#shotDsl").style.borderColor = "var(--line)";
  await syncProject();
  render();
}

async function syncProject() {
  project = await window.shotFactory.updateProject(project);
  queueAutosave();
}

async function saveProject(saveAs) {
  const result = await window.shotFactory.saveProject(saveAs);
  project = result.project;
  currentProjectPath = result.filePath;
  renderHeader();
  return result;
}

function queueAutosave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (currentProjectPath) saveProject(false);
  }, 900);
}

async function generateShots(options) {
  setBusy(true);
  beginGenerationProgress();
  try {
    project = await window.shotFactory.generateBatch(options);
    await saveProject(false);
    render();
  } catch (error) {
    showFeedback("error", "生成失败", error.message);
  } finally {
    endGenerationProgress();
    setBusy(false);
  }
}

function setBusy(isBusy) {
  $("#generateBtn").disabled = isBusy;
  const singleButton = $("#generateShotBtn");
  const cancelButton = $("#cancelGenerateBtn");
  if (singleButton) singleButton.disabled = isBusy;
  if (cancelButton) cancelButton.disabled = !isBusy;
  $("#generateBtn").textContent = isBusy ? "生成中..." : "批量生成分镜图";
  if (singleButton) singleButton.textContent = isBusy ? "生成中..." : "生成当前镜头";
}

function setCompactView(enabled) {
  compactView = enabled;
  $("#canvas").classList.toggle("compact-view", enabled);
  $("#viewBoardBtn").classList.toggle("active", !enabled);
  $("#viewCompactBtn").classList.toggle("active", enabled);
}

function setInspectorTab(tab) {
  $$(".inspector-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  $$(".tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tab;
  });
}

function zoomBy(delta) {
  project.canvas.scale = Math.max(0.35, Math.min(1.8, project.canvas.scale + delta));
  renderCanvasTransform();
  renderHeader();
  syncProject();
}

function render() {
  renderHeader();
  renderSettings();
  renderAssets();
  renderCanvas();
  renderInspector();
  renderProcessLogs();
  setCompactView(compactView);
}

function renderHeader() {
  $("#projectTitle").textContent = project.name;
  $("#projectMeta").textContent = `${project.shots.length} shots · ${project.source.fileName || "示例剧情"}${currentProjectPath ? ` · ${currentProjectPath}` : ""}`;
  $("#zoomLabel").textContent = `${Math.round(project.canvas.scale * 100)}%`;
  renderShotStats();
}

function renderShotStats() {
  const total = project.shots.length;
  const success = project.shots.filter((shot) => shot.generationStatus === "success").length;
  const failed = project.shots.filter((shot) => shot.generationStatus === "failed").length;
  const pending = total - success - failed;
  $("#shotStats").innerHTML = [
    ["总镜头", total],
    ["已生成", success],
    ["失败", failed],
    ["待处理", pending]
  ].map(([label, value]) => `<span><strong>${value}</strong>${label}</span>`).join("");
}

function renderSettings() {
  $("#projectName").value = project.name;
  normalizeProjectSettings();
  $("#provider").value = project.settings.provider;
  $("#apiKey").value = project.settings.apiKey;
  $("#apiBaseUrl").value = project.settings.apiBaseUrl || "https://api.openai.com/v1";
  $("#customEndpoint").value = project.settings.customEndpoint || "";
  $("#skillPath").value = project.settings.skillPath || "";
  $("#model").value = project.settings.model;
  $("#size").value = normalizeAspectValue(project.settings.aspectRatio || project.settings.size);
  $("#quality").value = project.settings.quality;
  $("#outputFormat").value = project.settings.outputFormat || "png";
  $("#moderation").value = project.settings.moderation || "auto";
  $("#retryLimit").value = project.settings.retryLimit ?? 2;
  $("#requestTimeoutSeconds").value = project.settings.requestTimeoutSeconds ?? 180;
  $("#visionQualityEnabled").value = String(Boolean(project.settings.visionQualityEnabled));
  $("#visionModel").value = project.settings.visionModel || "gpt-4o-mini";
  updateProviderHint();
}

function updateProviderHint() {
  const provider = $("#provider")?.value || project.settings.provider;
  const hint = $("#providerHint");
  if (!hint) return;
  hint.textContent = provider === "custom"
    ? "自定义平台会调用完整 Endpoint；第三方 Skill JSON 会参与 Prompt 编译，视觉质检需另配 OpenAI-compatible API Base URL。"
    : "GPT Image 会调用 API Base URL 下的 /images/generations；第三方 Skill JSON 可覆盖风格、负面词和质检规则。";
}

function renderProcessLogs() {
  normalizeProjectSettings();
  project.processLogs ||= [];
  project.settings.visionQualityEnabled ??= false;
  project.settings.visionModel ||= "gpt-4o-mini";
  const latest = project.processLogs[0];
  if (latest) showFeedback(latest.level, latest.message, latest.detail);
  const list = $("#processLogList");
  if (!list) return;
  list.innerHTML = project.processLogs.slice(0, 12).map((log) => `
    <div class="process-log-item ${escapeHtml(log.level)}">
      <strong>${escapeHtml(log.message)}</strong>
      <span>${escapeHtml(log.detail || "")}</span>
      <small>${new Date(log.createdAt).toLocaleTimeString()}</small>
    </div>
  `).join("") || `<div class="process-log-item"><span>暂无日志</span></div>`;
}

function showLatestProcessLog() {
  const latest = project.processLogs?.[0];
  if (latest) showFeedback(latest.level, latest.message, latest.detail);
}

function showFeedback(level, message, detail = "") {
  const box = $("#processFeedback");
  if (!box) return;
  box.className = `process-feedback ${level}`;
  box.innerHTML = `<strong>${escapeHtml(message)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}`;
}
function renderAssets() {
  $("#assetSummary").innerHTML = [
    ["角色", project.assets.characters.length],
    ["场景", project.assets.scenes.length],
    ["风格", project.assets.styles.length]
  ].map(([label, count]) => `<div class="asset-row"><span>${label}</span><strong>${count}</strong></div>`).join("");
}

function normalizeProjectForCanvas() {
  project.canvas ||= { scale: 1, panX: 0, panY: 0 };
  project.assets ||= { characters: [], scenes: [], styles: [] };
  project.assets.characters ||= [];
  project.assets.scenes ||= [];
  project.assets.styles ||= [];
  allAssetEntries().forEach((asset, index) => {
    asset.kind ||= inferAssetKind(asset);
    asset.x ??= 80 + (index % 3) * 190;
    asset.y ??= 80 + Math.floor(index / 3) * 150;
  });
  project.shots.forEach((shot) => {
    shot.characterIds ||= [];
    shot.sceneIds ||= [];
    shot.styleIds ||= [];
  });
}

function renderAssetNodes() {
  allAssetEntries().forEach((asset) => {
    const node = document.createElement("article");
    node.className = `asset-node asset-${asset.kind}`;
    node.style.left = `${asset.x}px`;
    node.style.top = `${asset.y}px`;
    node.dataset.assetId = asset.id;
    node.dataset.kind = asset.kind;
    node.innerHTML = `
      <div class="asset-thumb">${asset.path ? `<img src="${asset.previewUrl || `file:///${asset.path.replaceAll("\\", "/")}`}" alt="${escapeHtml(asset.name)}" />` : ""}</div>
      <div class="asset-info"><strong>${escapeHtml(asset.name)}</strong><span>${assetKindLabel(asset.kind)}参考</span></div>
    `;
    node.addEventListener("pointerdown", startAssetDrag);
    canvas.appendChild(node);
  });
}

function startPan(event) {
  if (event.target !== viewport && event.target !== canvas) return;
  panState = {
    startX: event.clientX,
    startY: event.clientY,
    originX: project.canvas.panX || 0,
    originY: project.canvas.panY || 0
  };
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add("panning");
  viewport.addEventListener("pointermove", panMove);
  viewport.addEventListener("pointerup", endPan, { once: true });
}

function panMove(event) {
  if (!panState) return;
  project.canvas.panX = panState.originX + event.clientX - panState.startX;
  project.canvas.panY = panState.originY + event.clientY - panState.startY;
  renderCanvasTransform();
}

function endPan(event) {
  viewport.removeEventListener("pointermove", panMove);
  viewport.classList.remove("panning");
  panState = null;
  syncProject();
}

function startAssetDrag(event) {
  event.stopPropagation();
  const node = event.currentTarget;
  const asset = findAsset(node.dataset.assetId);
  if (!asset) return;
  assetDragState = {
    asset,
    startX: event.clientX,
    startY: event.clientY,
    originX: asset.x,
    originY: asset.y
  };
  node.setPointerCapture(event.pointerId);
  node.classList.add("dragging");
  node.addEventListener("pointermove", assetDragMove);
  node.addEventListener("pointerup", endAssetDrag, { once: true });
}

function assetDragMove(event) {
  if (!assetDragState) return;
  const scale = project.canvas.scale;
  assetDragState.asset.x = assetDragState.originX + (event.clientX - assetDragState.startX) / scale;
  assetDragState.asset.y = assetDragState.originY + (event.clientY - assetDragState.startY) / scale;
  event.currentTarget.style.left = `${assetDragState.asset.x}px`;
  event.currentTarget.style.top = `${assetDragState.asset.y}px`;
}

function endAssetDrag(event) {
  event.currentTarget.removeEventListener("pointermove", assetDragMove);
  event.currentTarget.classList.remove("dragging");
  const asset = assetDragState?.asset;
  assetDragState = null;
  if (asset) {
    const shot = findShotAtCanvasPoint(asset.x + 80, asset.y + 48);
    if (shot) bindAssetToShot(asset, shot);
  }
  syncProject();
  render();
}

function bindAssetToShot(asset, shot) {
  shot.characterIds ||= [];
  shot.sceneIds ||= [];
  shot.styleIds ||= [];
  const target = asset.kind === "character" ? shot.characterIds : asset.kind === "scene" ? shot.sceneIds : shot.styleIds;
  if (!target.includes(asset.id)) target.push(asset.id);
  selectedShotId = shot.id;
}

function findShotAtCanvasPoint(x, y) {
  return project.shots.find((shot) => x >= shot.x && x <= shot.x + 372 && y >= shot.y && y <= shot.y + 542);
}

function boundAssetTags(shot) {
  const assets = [
    ...shot.characterIds.map((id) => findAsset(id)).filter(Boolean),
    ...shot.sceneIds.map((id) => findAsset(id)).filter(Boolean),
    ...(shot.styleIds || []).map((id) => findAsset(id)).filter(Boolean)
  ];
  if (!assets.length) return "";
  return `<div class="bound-assets">${assets.map((asset) => `<span>${assetKindLabel(asset.kind)} · ${escapeHtml(asset.name)}</span>`).join("")}</div>`;
}

function allAssetEntries() {
  return [
    ...project.assets.characters.map((asset) => ({ ...asset, kind: asset.kind || "character" })),
    ...project.assets.scenes.map((asset) => ({ ...asset, kind: asset.kind || "scene" })),
    ...project.assets.styles.map((asset) => ({ ...asset, kind: asset.kind || "style" }))
  ].map((asset) => findAsset(asset.id) || asset);
}

function findAsset(id) {
  return [...project.assets.characters, ...project.assets.scenes, ...project.assets.styles].find((asset) => asset.id === id);
}

function inferAssetKind(asset) {
  if (project.assets.characters.includes(asset)) return "character";
  if (project.assets.scenes.includes(asset)) return "scene";
  return "style";
}

function assetKindLabel(kind) {
  return { character: "人物", scene: "场景", style: "风格" }[kind] || "参考";
}
function renderCanvas() {
  normalizeProjectForCanvas();
  canvas.innerHTML = "";
  project.shots.forEach((shot, index) => {
    normalizeShotDsl(shot);
    const card = document.createElement("article");
    card.className = `shot-card ${shot.id === selectedShotId ? "selected" : ""}`;
    card.style.left = `${shot.x}px`;
    card.style.top = `${shot.y}px`;
    card.dataset.id = shot.id;
    card.innerHTML = shotCardTemplate(shot, index);
    card.addEventListener("pointerdown", startDrag);
    card.addEventListener("click", () => {
      selectedShotId = shot.id;
      render();
    });
    canvas.appendChild(card);
  });
  renderAssetNodes();
  renderCanvasTransform();
}

function renderCanvasTransform() {
  canvas.style.transform = `translate(${project.canvas.panX}px, ${project.canvas.panY}px) scale(${project.canvas.scale})`;
}

function shotCardTemplate(shot, index) {
  const qualityClass = shot.quality?.status || "pending";
  const camera = cameraSummary(shot);
  return `
    <div class="shot-strip">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(statusLabel(shot.generationStatus))}</strong>
    </div>
    <div class="shot-image">${shot.imageUrl ? `<img src="${shot.imageUrl}" alt="${escapeHtml(shot.title)}" />` : `<span class="image-placeholder">等待生成</span>`}</div>
    <div class="shot-content">
      <h3>${escapeHtml(shot.title)}</h3>
      <div class="shot-meta">
        ${camera.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
        <span class="tag ${qualityClass}">${statusLabel(shot.quality?.status)}</span>
      </div>
      ${boundAssetTags(shot)}
      <p class="shot-beat">${escapeHtml(shot.dsl.beat)}</p>
      <div class="prompt-preview">${escapeHtml(shot.prompt)}</div>
    </div>
  `;
}

function startDrag(event) {
  const card = event.currentTarget;
  const shot = project.shots.find((item) => item.id === card.dataset.id);
  selectedShotId = shot.id;
  dragState = {
    shot,
    startX: event.clientX,
    startY: event.clientY,
    originX: shot.x,
    originY: shot.y
  };
  card.setPointerCapture(event.pointerId);
  card.addEventListener("pointermove", dragMove);
  card.addEventListener("pointerup", endDrag, { once: true });
}

function dragMove(event) {
  if (!dragState) return;
  const scale = project.canvas.scale;
  dragState.shot.x = dragState.originX + (event.clientX - dragState.startX) / scale;
  dragState.shot.y = dragState.originY + (event.clientY - dragState.startY) / scale;
  event.currentTarget.style.left = `${dragState.shot.x}px`;
  event.currentTarget.style.top = `${dragState.shot.y}px`;
}

function endDrag(event) {
  event.currentTarget.removeEventListener("pointermove", dragMove);
  dragState = null;
  syncProject();
  render();
}

function renderInspector() {
  const shot = getSelectedShot();
  $("#emptyInspector").hidden = Boolean(shot);
  $("#shotInspector").hidden = !shot;
  if (!shot) return;

  normalizeShotDsl(shot);
  $("#inspectTitle").textContent = shot.title;
  $("#inspectSubtitle").textContent = cameraSummary(shot).join(" · ");
  $("#inspectStatus").textContent = statusLabel(shot.generationStatus);
  $("#shotTitle").value = shot.title;
  $("#shotBeat").value = shot.dsl.beat || "";
  $("#shotBlocking").value = shot.dsl.blocking || "";
  $("#shotDsl").value = JSON.stringify(shot.dsl, null, 2);
  $("#shotPrompt").value = shot.prompt;
  $("#negativePrompt").value = shot.negativePrompt;
  $("#qualityList").innerHTML = (shot.quality?.checks || []).map((item) => `<div class="quality-item"><span>${escapeHtml(item.name)}</span><strong>${item.passed ? "通过" : "待处理"}</strong></div>`).join("") || `<div class="quality-item"><span>等待质检</span><strong>pending</strong></div>`;
  $("#generationLog").innerHTML = shot.generationLog.map((item) => `<div class="log-item"><span>${escapeHtml(item.message)}${item.imagePath ? `<br>${escapeHtml(item.imagePath)}` : ""}</span><strong>${escapeHtml(item.status)}</strong></div>`).join("") || `<div class="log-item"><span>暂无记录</span><strong>idle</strong></div>`;
  renderLanguagePalette(shot);
}

function renderLanguagePalette(shot) {
  $("#shotLanguageSummary").innerHTML = cameraSummary(shot).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  $("#languagePalette").innerHTML = Object.entries(CINEMA_LANGUAGE).map(([groupKey, group]) => `
    <section class="language-group">
      <h3>${group.title}</h3>
      <div>
        ${group.items.map(([code, label, prompt]) => {
          const active = isLanguageActive(shot, groupKey, code, label);
          return `<button class="${active ? "active" : ""}" data-language-group="${groupKey}" data-code="${code}" data-label="${label}" data-prompt="${escapeHtml(prompt)}">${label}</button>`;
        }).join("")}
      </div>
    </section>
  `).join("");

  $$("[data-language-group]").forEach((button) => {
    button.addEventListener("click", () => applyLanguage(button.dataset.languageGroup, button.dataset.code, button.dataset.label, button.dataset.prompt));
  });
}

async function applyLanguage(groupKey, code, label, prompt) {
  const shot = getSelectedShot();
  if (!shot) return;
  normalizeShotDsl(shot);
  const group = CINEMA_LANGUAGE[groupKey];

  if (group.target === "camera") {
    if (groupKey === "shotSizes") {
      shot.dsl.shotType = label;
      shot.dsl.camera.shotSize = code;
      shot.dsl.camera.shotSizeLabel = label;
    }
    if (groupKey === "angles") {
      shot.dsl.camera.angle = code;
      shot.dsl.camera.angleLabel = label;
    }
    if (groupKey === "movements") {
      shot.dsl.camera.movement = code;
      shot.dsl.camera.movementLabel = label;
    }
    if (groupKey === "lenses") {
      shot.dsl.camera.lens = code;
      shot.dsl.camera.lensLabel = label;
    }
    shot.dsl.camera.prompt = buildCameraPrompt(shot.dsl.camera);
  } else if (group.target === "emotion") {
    shot.dsl.emotion = label;
    shot.dsl.emotionCode = code;
    shot.dsl.emotionPrompt = prompt;
  } else {
    shot.dsl[group.target] = { code, label, prompt };
  }

  await syncProject();
  render();
}

function isLanguageActive(shot, groupKey, code, label) {
  const dsl = shot.dsl;
  if (groupKey === "shotSizes") return dsl.camera?.shotSize === code || dsl.shotType === label;
  if (groupKey === "angles") return dsl.camera?.angle === code || dsl.camera?.angleLabel === label;
  if (groupKey === "movements") return dsl.camera?.movement === code || dsl.camera?.movementLabel === label;
  if (groupKey === "lenses") return dsl.camera?.lens === code || dsl.camera?.lensLabel === label;
  if (groupKey === "emotions") return dsl.emotionCode === code || dsl.emotion === label;
  return dsl[CINEMA_LANGUAGE[groupKey].target]?.code === code;
}

function normalizeShotDsl(shot) {
  shot.dsl ||= {};
  shot.dsl.camera ||= {};
  shot.dsl.camera.shotSizeLabel ||= shot.dsl.shotType || shot.dsl.camera.angle || "中景";
  shot.dsl.camera.angleLabel ||= labelFrom("angles", shot.dsl.camera.angle) || "平视";
  shot.dsl.camera.movementLabel ||= labelFrom("movements", shot.dsl.camera.movement) || shot.dsl.camera.movement || "静态";
  shot.dsl.camera.lensLabel ||= labelFrom("lenses", shot.dsl.camera.lens) || shot.dsl.camera.lens || "35mm";
  shot.dsl.composition ||= { code: "rule_of_thirds", label: "三分法", prompt: "rule of thirds composition, clean visual hierarchy" };
  shot.dsl.lighting ||= { code: "soft_key", label: "柔主光", prompt: "soft key light, gentle skin tone and readable emotion" };
  shot.dsl.rhythm ||= { code: "hold", label: "长停顿", prompt: "held moment, quiet tension before action" };
  shot.dsl.transition ||= { code: "cut", label: "硬切", prompt: "hard cut transition" };
  shot.dsl.performance ||= "表演克制但可读，面部表情、手部动作和身体重心服务当前剧情拍点";
  shot.dsl.camera.prompt = buildCameraPrompt(shot.dsl.camera);
}

function buildCameraPrompt(camera) {
  return [
    promptFrom("shotSizes", camera.shotSize, camera.shotSizeLabel),
    promptFrom("angles", camera.angle, camera.angleLabel),
    promptFrom("movements", camera.movement, camera.movementLabel),
    promptFrom("lenses", camera.lens, camera.lensLabel)
  ].filter(Boolean).join(", ");
}

function cameraSummary(shot) {
  normalizeShotDsl(shot);
  return [
    shot.dsl.camera.shotSizeLabel,
    shot.dsl.camera.angleLabel,
    shot.dsl.camera.movementLabel,
    shot.dsl.camera.lensLabel,
    shot.dsl.composition?.label,
    shot.dsl.lighting?.label,
    shot.dsl.rhythm?.label
  ].filter(Boolean).slice(0, 7);
}

function labelFrom(groupKey, code) {
  const item = CINEMA_LANGUAGE[groupKey]?.items.find(([itemCode, label]) => itemCode === code || label === code);
  return item?.[1] || "";
}

function promptFrom(groupKey, code, label) {
  const item = CINEMA_LANGUAGE[groupKey]?.items.find(([itemCode, itemLabel]) => itemCode === code || itemLabel === label);
  return item?.[2] || "";
}

async function runSelfCheck() {
  const report = await window.shotFactory.selfCheck();
  $("#selfCheckSummary").textContent = `${readinessLabel(report.level)} · 阻断 ${report.blockers} · 警告 ${report.warnings}`;
  $("#selfCheckSummary").className = `self-check-summary ${report.level}`;
  $("#selfCheckList").innerHTML = report.findings.map((item) => `
    <div class="self-check-item ${item.severity}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.detail)}</span>
    </div>
  `).join("");
}

function getSelectedShot() {
  return project.shots.find((shot) => shot.id === selectedShotId);
}

function statusLabel(status) {
  return {
    idle: "待生成",
    running: "生成中",
    success: "已生成",
    failed: "失败",
    passed: "质检通过",
    warning: "需复查",
    pending: "待质检"
  }[status] || status || "待处理";
}

function readinessLabel(level) {
  return {
    "not-ready": "不能投入生产",
    "pilot-ready": "可小规模试生产",
    "production-ready": "生产就绪"
  }[level] || level;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();



















