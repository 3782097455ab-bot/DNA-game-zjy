const ROUND_TIME = 75_000;
const INTRO_TIME = 1_850;
const SCORE_TYPES = {
  correct: { label: "标准配对", points: 10 },
  cross: { label: "跨类错配", points: 2 },
  same: { label: "同类错配", points: 0 },
};

const LESSONS = [
  { sequence: "AGTCACGT", gene: "HBB", name: "血红蛋白 β 链", description: "HBB 编码血红蛋白的 β 链。血红蛋白让红细胞能把氧气从肺运到身体各处。" },
  { sequence: "TGCAGCAT", gene: "LCT", name: "乳糖酶", description: "LCT 编码乳糖酶。它在小肠中帮助把乳糖分解为可吸收的葡萄糖和半乳糖。" },
  { sequence: "CATGAGTC", gene: "TYR", name: "酪氨酸酶", description: "TYR 编码酪氨酸酶。它参与黑色素的合成，影响肤色、发色和眼睛的颜色。" },
];

const byId = id => document.getElementById(id);
const pages = ["home", "lab", "challenge", "results"];
const controls = Array.from(document.querySelectorAll("[data-base]"));
const infoDialog = byId("info-dialog");
const checkpoint = byId("segment-dialog");
const scene = new ReplicationScene(byId("fork-canvas"));
const storageKey = "dna-builder-gene-gallery";
let unlocked = readGallery();
let session = null;
let round = null;
let frame = 0;
let previousTimestamp = null;

function readGallery() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(Array.isArray(stored) ? stored.filter(gene => LESSONS.some(lesson => lesson.gene === gene)) : []);
  } catch {
    return new Set();
  }
}

function unlock(gene) {
  unlocked.add(gene);
  try {
    localStorage.setItem(storageKey, JSON.stringify([...unlocked]));
  } catch {
    // The current session still retains its unlocked cards.
  }
}

function showPage(page, heading) {
  for (const name of pages) byId(name).hidden = name !== page;
  document.body.dataset.page = page;
  byId("home-button").hidden = page === "home";
  window.scrollTo({ top: 0, behavior: "instant" });
  byId(heading).focus({ preventScroll: true });
}

function stopFrame() {
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
  previousTimestamp = null;
}

function goHome() {
  challenge.stop();
  stopFrame();
  session = null;
  round = null;
  showPage("home", "title");
}

function start(mode) {
  challenge.stop();
  stopFrame();
  session = {
    mode,
    index: 0,
    completed: 0,
    remaining: ROUND_TIME,
    score: 0,
    counts: { correct: 0, cross: 0, same: 0 },
    paused: false,
    zoomed: false,
  };
  byId("lab-title").textContent = mode === "demo" ? "复制演示" : "复制叉";
  byId("lab-kicker").textContent = "DNA 半保留复制";
  for (const id of ["segment-readout", "clock-readout", "score-readout", "base-controls"]) {
    byId(id).hidden = mode === "demo";
  }
  byId("demo-play").hidden = mode !== "demo";
  byId("interaction-title").textContent = mode === "demo" ? "观察双链怎样复制" : "选择互补碱基";
  showPage("lab", "lab-title");
  startSegment();
}

function startSegment() {
  round = {
    sequence: LESSONS[session.index].sequence,
    phase: "intro",
    time: 0,
    introDuration: scene.reducedMotion ? 800 : INTRO_TIME,
    pairs: [],
    fragments: [],
    attempt: null,
    demoAt: 0,
    joined: false,
    replaceAt: null,
    joinAt: null,
    endAt: null,
    score: 0,
  };
  session.paused = false;
  session.zoomed = false;
  previousTimestamp = null;
  scene.reset();
  feedback("解旋酶正在打开亲代双链");
  updateLab();
  queueFrame();
}

function feedback(message, kind = "") {
  const output = byId("feedback");
  output.textContent = message;
  output.dataset.kind = kind;
  byId("lab-guide").dataset.kind = kind || "hint";
}

function activeTemplate() {
  return round.sequence[round.pairs.length];
}

function updateLab() {
  const template = activeTemplate();
  const available = session.mode === "play" && round.phase === "ready" && !session.paused && !infoDialog.open;
  for (const button of controls) {
    button.disabled = !available;
    button.classList.toggle("chosen", button.dataset.base === round.attempt?.base);
  }
  byId("segment").textContent = (session.index + 1) + " / " + LESSONS.length;
  byId("score").textContent = session.score;
  byId("pause").textContent = session.paused ? "继续" : "暂停";
  byId("pause").setAttribute("aria-pressed", String(session.paused));
  byId("pause").disabled = round.phase === "checkpoint";
  byId("scene-note").hidden = !session.paused;
  byId("scene-note").textContent = session.mode === "demo" ? "演示已暂停" : "练习已暂停";
  byId("zoom").disabled = !template || round.phase === "intro" || round.phase === "checkpoint";
  byId("zoom").setAttribute("aria-pressed", String(session.zoomed));
  byId("zoom").lastChild.textContent = session.zoomed ? " 返回全景" : " 放大位点";

  const showSite = template && round.phase !== "intro";
  byId("site-caption").textContent = showSite ? "当前模板碱基" : "观察复制叉";
  byId("observed-letter").textContent = showSite ? template : "—";
  byId("observed-name").textContent = showSite ? BASE[template].name : "";
  if (round.phase === "intro") {
    byId("site-context").textContent = "解旋酶打开双链，两条亲代链露出碱基。";
  } else if (showSite) {
    byId("site-context").textContent = "箭头指向聚合酶即将读取的这个位点。";
  } else {
    byId("site-context").textContent = "移除 RNA 引物、补齐 DNA，再由连接酶封合片段间的缺口。";
  }
  updateClock();
}

function updateClock() {
  const seconds = Math.ceil(session.remaining / 1000);
  const clock = byId("clock");
  const formatted = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  if (clock.textContent !== formatted) clock.textContent = formatted;
  clock.classList.toggle("urgent", seconds <= 10);
}

function queueFrame() {
  if (!frame) frame = window.requestAnimationFrame(tick);
}

function tick(timestamp) {
  frame = 0;
  if (!session || document.body.dataset.page !== "lab") return;
  const dt = previousTimestamp === null ? 0 : timestamp - previousTimestamp;
  previousTimestamp = timestamp;

  if (!session.paused && !infoDialog.open && !checkpoint.open) {
    round.time += dt;
    if (round.phase === "ready" && session.mode === "play") {
      session.remaining = Math.max(0, session.remaining - dt);
      updateClock();
      if (session.remaining === 0) return finish("timeout");
    }
    advance();
  }

  if (document.body.dataset.page === "lab") {
    scene.render(round, session.zoomed);
    queueFrame();
  }
}

function advance() {
  const { time, phase } = round;
  if (phase === "intro" && time >= round.introDuration) {
    round.phase = "ready";
    round.demoAt = time + 580;
    feedback(session.mode === "demo" ? "聚合酶读取模板，识别互补碱基" : "按 A、T、C、G，或点击下方碱基");
    updateLab();
  } else if (phase === "ready" && session.mode === "demo" && time >= round.demoAt) {
    submitBase(BASE[activeTemplate()].partner, true);
  } else if (phase === "pairing" && time - round.attempt.at >= round.attempt.duration) {
    completeAttempt();
  } else if (phase === "joining") {
    if (!round.joined && time >= round.joinAt) {
      round.joined = true;
      feedback("连接酶封合缺口，形成连续的后随链");
    }
    if (time >= round.endAt) completeSegment();
  }
}

function submitBase(base, automatic = false) {
  if (!session || document.body.dataset.page !== "lab" ||
      round.phase !== "ready" || session.paused || infoDialog.open || checkpoint.open ||
      (!automatic && session.mode !== "play") || !Object.hasOwn(BASE, base)) return;

  const template = activeTemplate();
  const kind = pairType(template, base);
  const duration = scene.reducedMotion ? 165 : kind === "correct" ? 405 : 680;
  round.attempt = { base, kind, at: round.time, duration };
  round.phase = "pairing";
  const { label, points } = SCORE_TYPES[kind];
  feedback(template + "–" + base + " · " + label + (session.mode === "play" ? " +" + points : ""), kind);
  updateLab();
}

function completeAttempt() {
  const { base, kind } = round.attempt;
  const correctBase = BASE[activeTemplate()].partner;
  const points = SCORE_TYPES[kind].points;
  round.pairs.push({ selected: base, kind });
  session.counts[kind] += 1;
  session.score += points;
  round.score += points;
  round.attempt = null;
  const count = round.pairs.length;

  const fragmentStart = (round.fragments.at(-1)?.end ?? -1) + 1;
  if (count - fragmentStart === 3 || count === round.sequence.length) {
    round.fragments.push({ start: fragmentStart, end: count - 1, at: round.time });
  }
  if (kind !== "correct") {
    feedback(SCORE_TYPES[kind].label + " +" + points + " · 校对后补入 " + correctBase, kind);
  }

  if (count === round.sequence.length) {
    round.phase = "joining";
    round.replaceAt = round.time + (scene.reducedMotion ? 200 : 790);
    round.joinAt = round.replaceAt + 310;
    round.endAt = round.joinAt + 760;
    session.zoomed = false;
    if (kind === "correct") feedback("后随链的最后一个冈崎片段正在延伸");
  } else {
    round.phase = "ready";
    round.demoAt = round.time + 505;
  }
  updateLab();
}

function completeSegment() {
  session.completed += 1;
  if (session.mode === "demo") return finish("demo");
  const lesson = LESSONS[session.index];
  unlock(lesson.gene);
  round.phase = "checkpoint";
  byId("segment-title").textContent = lesson.gene + " · " + lesson.name;
  byId("segment-description").textContent = lesson.description;
  byId("segment-total").textContent = "本段得分 " + round.score;
  byId("continue").firstChild.textContent = session.completed === LESSONS.length ? "查看结算 " : "继续复制 ";
  updateLab();
  checkpoint.showModal();
}

function nextSegment() {
  if (!checkpoint.open || !session || round.phase !== "checkpoint") return;
  checkpoint.close();
  if (session.completed === LESSONS.length) return finish("finished");
  session.index += 1;
  startSegment();
  byId("lab-title").focus({ preventScroll: true });
}

function finish(reason) {
  stopFrame();
  const demo = reason === "demo";
  const timeout = reason === "timeout";
  const answered = Object.values(session.counts).reduce((sum, count) => sum + count, 0);
  const accuracy = answered ? Math.round(100 * session.counts.correct / answered) + "%" : "—";
  byId("result-title").textContent = demo ? "一条旧链，一条新链" : timeout ? "本轮时间到" : "复制完成";
  byId("result-kicker").textContent = demo ? "半保留复制" : "练习结算";
  byId("result-copy").textContent = demo
    ? "两条新链都沿 5′→3′ 合成。每个子代 DNA 分子各含一条亲代链和一条新链。"
    : "正确率按已作答位点计算。错配的位点在动画中经过校对，再填入标准互补碱基。";
  byId("result-stats").hidden = demo;
  byId("result-breakdown").hidden = demo;
  byId("result-genes").hidden = demo;
  byId("replay").firstChild.textContent = demo ? "开始练习 " : "再玩一局 ";
  const statistics = [["总分", session.score], ["正确率", accuracy], ["完成片段", session.completed + " / " + LESSONS.length]];
  byId("result-stats").innerHTML = statistics.map(([label, value]) => "<div><dt>" + label + "</dt><dd>" + value + "</dd></div>").join("");
  byId("result-breakdown").innerHTML = Object.entries(SCORE_TYPES).map(([kind, { label }]) =>
    "<li><span>" + label + "</span><b>" + session.counts[kind] + "</b></li>").join("");
  showPage("results", "result-title");
}

function openInfo(topic) {
  const content = byId("info-content");
  if (topic === "mechanism") {
    byId("info-title").textContent = "DNA 怎样复制？";
    content.innerHTML = '<img src="assets/replication.webp" alt="一个亲代双链复制成两个各有一条旧链、一条新链的子代双链">' +
      "<p>解旋酶打开两条反向平行的亲代链。DNA 聚合酶沿模板的 3′→5′ 方向读取，只在新链的 3′ 端加入核苷酸，因此两条新链都沿 5′→3′ 合成。</p>" +
      "<p>前导链朝复制叉连续延伸。后随链的一段从靠近复制叉的引物起步，朝远离复制叉的方向延伸。引物随后被移除并由 DNA 补上，连接酶封合缺口。</p>" +
      '<p><a href="https://pubmed.ncbi.nlm.nih.gov/4989398/" target="_blank" rel="noopener noreferrer">冈崎片段的合成方向实验 ↗</a></p>' +
      '<button class="primary" type="button" data-action="demo">观看复制演示 <span aria-hidden="true">↗</span></button>';
  } else if (topic === "rules") {
    byId("info-title").textContent = "玩法说明";
    content.innerHTML = "<p>看左侧大字和复制叉上的箭头，找到当前模板碱基。点击或按键输入 A、T、C、G。</p>" +
      "<ul class='lesson-list'><li>标准互补配对（A–T、G–C）得 10 分。</li><li>跨类错配得 2 分，同类错配得 0 分。分档用于游戏计分。</li><li>三段练习共用 75 秒作答时间。解旋、配对动画和图鉴讲解期间暂停计时。</li></ul>" +
      "<p>练习以短序列展示复制过程。每完成一段，解锁一张独立的基因功能卡。</p>" +
      "<p><b>双叉挑战</b>用 Q / E 切换左右叉。按住 A、T、C、G 配对，Shift 校对，F 放置引物或连接片段，同时点击对应位点。也可以点击屏幕下方的工具来选择。</p>";
  } else {
    byId("info-title").textContent = "基因图鉴";
    content.innerHTML = '<dl class="gene-list">' + LESSONS.map((lesson, index) => {
      const visible = unlocked.has(lesson.gene);
      const state = visible ? "已解锁" : "待解锁";
      const description = visible ? lesson.description : "完成练习片段 " + (index + 1) + " 后解锁。";
      return "<div><dt>" + lesson.gene + "<span>" + state + "</span></dt><dd>" + description + "</dd></div>";
    }).join("") + "</dl>";
  }
  infoDialog.showModal();
  challenge.clearTools();
  if (document.body.dataset.page === "lab") updateLab();
}

function togglePause() {
  session.paused = !session.paused;
  previousTimestamp = null;
  updateLab();
}

for (const button of controls) {
  button.addEventListener("click", () => submitBase(button.dataset.base));
}

document.addEventListener("click", event => {
  const button = event.target.closest("button");
  const topic = button?.dataset.dialog;
  const action = button?.dataset.action;
  if (topic) openInfo(topic);
  if (action) {
    if (infoDialog.open) infoDialog.close();
    if (action === "home") goHome();
    else if (action === "challenge") {
      stopFrame();
      challenge.open();
    } else start(action);
  }
});

document.addEventListener("keydown", event => {
  if (!session || document.body.dataset.page !== "lab" || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
      infoDialog.open || checkpoint.open) return;
  const base = event.key.toUpperCase();
  if (Object.hasOwn(BASE, base)) submitBase(base);
});

byId("info-close").addEventListener("click", () => infoDialog.close());
infoDialog.addEventListener("close", () => {
  if (document.body.dataset.page === "lab") {
    previousTimestamp = null;
    updateLab();
  }
});
byId("pause").addEventListener("click", togglePause);
byId("zoom").addEventListener("click", () => {
  session.zoomed = !session.zoomed;
  updateLab();
});
byId("continue").addEventListener("click", nextSegment);
checkpoint.addEventListener("cancel", event => {
  event.preventDefault();
  nextSegment();
});
