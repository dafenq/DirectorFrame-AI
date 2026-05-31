const { DIRECTOR_LEXICON } = require("./directorLexicon");

function splitStoryIntoBeats(text) {
  return text
    .split(/\n+|(?<=[。！？!?])/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 48);
}

function beatToShotDsl(beat, index) {
  const shotSize = pick("shotSizes", index);
  const angle = pick("angles", index + 1);
  const movement = pick("movements", index);
  const lens = pick("lenses", index + 2);
  const composition = pick("compositions", index + 3);
  const lighting = pick("lighting", index + 4);
  const rhythm = pick("rhythms", index);
  const transition = pick("transitions", index);
  const emotion = pick("emotions", index + 2);

  return {
    id: `shot-${String(index + 1).padStart(3, "0")}`,
    beat,
    shotType: shotSize.label,
    camera: {
      shotSize: shotSize.code,
      shotSizeLabel: shotSize.label,
      angle: angle.code,
      angleLabel: angle.label,
      lens: lens.code,
      lensLabel: lens.label,
      movement: movement.code,
      movementLabel: movement.label,
      prompt: [shotSize.prompt, angle.prompt, movement.prompt, lens.prompt].join(", ")
    },
    composition: {
      code: composition.code,
      label: composition.label,
      prompt: composition.prompt
    },
    lighting: {
      code: lighting.code,
      label: lighting.label,
      prompt: lighting.prompt
    },
    rhythm: {
      code: rhythm.code,
      label: rhythm.label,
      prompt: rhythm.prompt
    },
    transition: {
      code: transition.code,
      label: transition.label,
      prompt: transition.prompt
    },
    blocking: "主角位于视觉焦点，背景服务剧情信息，动作关系清晰，视线方向连续",
    emotion: emotion.label,
    emotionCode: emotion.code,
    performance: "表演克制但可读，面部表情、手部动作和身体重心服务当前剧情拍点",
    continuity: "与前后镜头保持角色服装、发型、道具、场景光线和屏幕方向一致",
    qualityRules: ["角色一致性", "场景一致性", "画面可读性", "无多余肢体", "无文字水印"]
  };
}

function pick(group, index) {
  const items = DIRECTOR_LEXICON[group];
  return items[index % items.length];
}

function createShotDslFromScript(text) {
  return splitStoryIntoBeats(text).map(beatToShotDsl);
}

module.exports = {
  createShotDslFromScript
};
