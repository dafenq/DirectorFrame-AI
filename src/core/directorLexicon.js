const DIRECTOR_LEXICON = {
  shotSizes: [
    { code: "ECU", label: "大特写", prompt: "extreme close-up, tiny facial detail, intense emotional focus" },
    { code: "CU", label: "特写", prompt: "close-up shot, expressive face, shallow depth of field" },
    { code: "MCU", label: "中近景", prompt: "medium close-up, upper body acting, readable emotion" },
    { code: "MS", label: "中景", prompt: "medium shot, body language and dialogue staging" },
    { code: "MLS", label: "中远景", prompt: "medium long shot, character and environment relationship" },
    { code: "WS", label: "远景", prompt: "wide shot, full body in the scene, spatial context" },
    { code: "EWS", label: "大远景", prompt: "extreme wide shot, environment dominates the frame" },
    { code: "OTS", label: "过肩", prompt: "over-the-shoulder shot, dialogue tension and eyeline match" }
  ],
  angles: [
    { code: "eye_level", label: "平视", prompt: "eye-level camera, natural perspective" },
    { code: "low_angle", label: "仰拍", prompt: "low angle, character appears powerful or threatening" },
    { code: "high_angle", label: "俯拍", prompt: "high angle, character appears vulnerable or observed" },
    { code: "dutch_angle", label: "倾斜构图", prompt: "dutch angle, unstable psychological tension" },
    { code: "top_down", label: "顶拍", prompt: "top-down shot, graphic composition and spatial clarity" },
    { code: "profile", label: "侧面", prompt: "profile angle, clear silhouette and emotional restraint" },
    { code: "back_view", label: "背影", prompt: "back view, withheld emotion, atmospheric storytelling" },
    { code: "pov", label: "主观镜头", prompt: "POV shot, subjective viewpoint and immediate immersion" }
  ],
  movements: [
    { code: "static", label: "静态", prompt: "locked-off camera, still composition" },
    { code: "push_in", label: "推镜", prompt: "slow push-in, rising emotional pressure" },
    { code: "pull_out", label: "拉远", prompt: "slow pull-out, emotional distance and isolation" },
    { code: "tracking", label: "跟拍", prompt: "tracking shot, following character movement" },
    { code: "pan", label: "摇镜", prompt: "pan camera movement, revealing new information" },
    { code: "tilt", label: "移轴/俯仰", prompt: "tilt camera movement, vertical reveal" },
    { code: "handheld", label: "手持", prompt: "subtle handheld camera, documentary immediacy" },
    { code: "crash_zoom", label: "急推", prompt: "crash zoom, sudden realization and dramatic shock" }
  ],
  lenses: [
    { code: "24mm", label: "24mm 广角", prompt: "24mm wide lens, strong spatial depth" },
    { code: "35mm", label: "35mm 叙事", prompt: "35mm cinematic lens, balanced subject and environment" },
    { code: "50mm", label: "50mm 标准", prompt: "50mm natural perspective, intimate realism" },
    { code: "85mm", label: "85mm 人像", prompt: "85mm portrait lens, compressed background, soft bokeh" },
    { code: "135mm", label: "135mm 长焦", prompt: "135mm telephoto lens, compressed space and observation" },
    { code: "macro", label: "微距", prompt: "macro lens, tactile detail and symbolic object focus" }
  ],
  compositions: [
    { code: "rule_of_thirds", label: "三分法", prompt: "rule of thirds composition, clean visual hierarchy" },
    { code: "centered", label: "中心构图", prompt: "centered composition, iconic and direct framing" },
    { code: "symmetry", label: "对称构图", prompt: "symmetrical composition, ritualistic visual order" },
    { code: "negative_space", label: "留白压迫", prompt: "negative space, isolation and emotional pressure" },
    { code: "frame_within_frame", label: "框中框", prompt: "frame within frame, trapped feeling" },
    { code: "leading_lines", label: "引导线", prompt: "leading lines guiding attention to the subject" },
    { code: "foreground_occlusion", label: "前景遮挡", prompt: "foreground occlusion, voyeuristic depth" },
    { code: "silhouette", label: "剪影", prompt: "silhouette composition, strong graphic emotion" }
  ],
  lighting: [
    { code: "soft_key", label: "柔主光", prompt: "soft key light, gentle skin tone and readable emotion" },
    { code: "hard_light", label: "硬光", prompt: "hard light, sharp contrast and dramatic shadows" },
    { code: "rim_light", label: "轮廓光", prompt: "rim light, separated silhouette and cinematic edge" },
    { code: "backlit", label: "逆光", prompt: "backlit scene, glowing atmosphere and mystery" },
    { code: "low_key", label: "低调光", prompt: "low-key lighting, noir contrast and suspense" },
    { code: "high_key", label: "高调光", prompt: "high-key lighting, clean bright dramatic clarity" },
    { code: "neon", label: "霓虹", prompt: "neon practical lights, urban night color contrast" },
    { code: "volumetric", label: "体积光", prompt: "volumetric light, visible beams and atmospheric depth" }
  ],
  rhythms: [
    { code: "hold", label: "长停顿", prompt: "held moment, quiet tension before action" },
    { code: "snap", label: "短促", prompt: "quick visual beat, sharp dramatic punctuation" },
    { code: "slow_burn", label: "慢燃", prompt: "slow-burn pacing, emotion accumulates gradually" },
    { code: "reveal", label: "揭示", prompt: "reveal beat, new information enters the frame" },
    { code: "impact", label: "冲击", prompt: "impact beat, strong emotional punctuation" },
    { code: "breath", label: "喘息", prompt: "breathing beat, brief release after tension" }
  ],
  transitions: [
    { code: "cut", label: "硬切", prompt: "hard cut transition" },
    { code: "match_cut", label: "匹配剪辑", prompt: "match cut, visual continuity between shots" },
    { code: "jump_cut", label: "跳切", prompt: "jump cut, compressed time and agitation" },
    { code: "fade", label: "淡入淡出", prompt: "fade transition, lyrical time passage" },
    { code: "whip_pan", label: "甩镜转场", prompt: "whip pan transition, fast energy and surprise" },
    { code: "insert", label: "插入镜头", prompt: "insert shot transition to a meaningful object detail" }
  ],
  emotions: [
    { code: "tension", label: "紧张", prompt: "tense atmosphere, restrained body language" },
    { code: "oppression", label: "压迫", prompt: "oppressive mood, heavy negative space and low-key light" },
    { code: "suspense", label: "悬疑", prompt: "suspenseful mood, partial reveal and uncertain eyeline" },
    { code: "intimacy", label: "亲密", prompt: "intimate mood, soft light and close physical distance" },
    { code: "lonely", label: "孤独", prompt: "lonely mood, wide framing and emotional distance" },
    { code: "anger", label: "爆发", prompt: "explosive anger, hard contrast and sharp posture" },
    { code: "relief", label: "松弛", prompt: "relief after tension, warmer light and open posture" },
    { code: "shock", label: "震惊", prompt: "shock, frozen expression and sudden visual emphasis" }
  ]
};

function findLexiconItem(group, code) {
  return DIRECTOR_LEXICON[group]?.find((item) => item.code === code || item.label === code) || null;
}

module.exports = {
  DIRECTOR_LEXICON,
  findLexiconItem
};
