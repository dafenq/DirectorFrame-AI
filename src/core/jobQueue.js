const fs = require("fs/promises");
const path = require("path");
const { getProjectStoreRoot } = require("./assetStore");

async function createGenerationJob(project, options, context) {
  const root = await getProjectStoreRoot(project, context.projectPath, context.userDataPath);
  const queueDir = path.join(root, "queue");
  await fs.mkdir(queueDir, { recursive: true });
  const selected = options?.selectedShotIds?.length ? new Set(options.selectedShotIds) : null;
  const shotIds = project.shots
    .filter((shot) => !(selected && !selected.has(shot.id)) && !(options?.skipSuccessful && shot.generationStatus === "success"))
    .map((shot) => shot.id);
  const now = new Date().toISOString();
  const job = {
    id: crypto.randomUUID(),
    projectId: project.id,
    projectName: project.name,
    status: "running",
    options: options || {},
    shotIds,
    completedShotIds: [],
    failedShotIds: [],
    pendingShotIds: shotIds,
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
    lastMessage: "任务已创建"
  };
  await writeJob(queueDir, job);
  return { ...job, queueDir };
}

async function updateGenerationJob(job, patch) {
  if (!job?.queueDir) return null;
  const next = {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  if (patch.completedShotId && !next.completedShotIds.includes(patch.completedShotId)) next.completedShotIds.push(patch.completedShotId);
  if (patch.failedShotId && !next.failedShotIds.includes(patch.failedShotId)) next.failedShotIds.push(patch.failedShotId);
  next.pendingShotIds = next.shotIds.filter((id) => !next.completedShotIds.includes(id) && !next.failedShotIds.includes(id));
  delete next.completedShotId;
  delete next.failedShotId;
  await writeJob(job.queueDir, next);
  Object.assign(job, next);
  return next;
}

async function finishGenerationJob(job, status, message) {
  if (!job?.queueDir) return null;
  return updateGenerationJob(job, {
    status,
    lastMessage: message || status,
    finishedAt: new Date().toISOString()
  });
}

async function listRecoverableJobs(project, context) {
  const root = await getProjectStoreRoot(project, context.projectPath, context.userDataPath);
  const queueDir = path.join(root, "queue");
  let files = [];
  try {
    files = await fs.readdir(queueDir);
  } catch {
    return [];
  }
  const jobs = [];
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    try {
      const job = JSON.parse(await fs.readFile(path.join(queueDir, file), "utf8"));
      if (["running", "interrupted"].includes(job.status) && job.pendingShotIds?.length) {
        jobs.push({ ...job, queueDir });
      }
    } catch {
      // Ignore damaged queue files; production self-check reports queue health separately.
    }
  }
  return jobs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function markRunningJobsInterrupted(project, context) {
  const jobs = await listRecoverableJobs(project, context);
  for (const job of jobs) {
    await updateGenerationJob(job, { status: "interrupted", lastMessage: "应用上次退出前任务未完成，可恢复。" });
  }
  return jobs;
}

async function writeJob(queueDir, job) {
  await fs.writeFile(path.join(queueDir, `${job.id}.json`), JSON.stringify(stripRuntimeFields(job), null, 2), "utf8");
}

function stripRuntimeFields(job) {
  const next = { ...job };
  delete next.queueDir;
  return next;
}

module.exports = {
  createGenerationJob,
  updateGenerationJob,
  finishGenerationJob,
  listRecoverableJobs,
  markRunningJobsInterrupted
};
