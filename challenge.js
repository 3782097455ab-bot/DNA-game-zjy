class ChallengeAudio {
  constructor() {
    this.enabled = false;
    this.context = null;
  }

  async toggle() {
    if (this.enabled) {
      this.enabled = false;
      return;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      this.context ??= new Audio();
      await this.context.resume();
      this.enabled = this.context.state === "running";
    } catch {
      this.enabled = false;
    }
  }

  cue(frequency, length = .08, volume = .04) {
    if (!this.enabled || this.context.state !== "running") return;
    const start = this.context.currentTime;
    const voice = this.context.createOscillator();
    const gain = this.context.createGain();
    voice.type = "sine";
    voice.frequency.value = frequency;
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .015);
    gain.gain.exponentialRampToValueAtTime(.001, start + length);
    voice.connect(gain);
    gain.connect(this.context.destination);
    voice.start(start);
    voice.stop(start + length + .02);
  }
}

const challengeLabels = {
  warmup: "单叉热身",
  dual: "双叉协作",
  sealed: "完成接合",
  division: "时间跳转 · 分裂期",
  complete: "两个子细胞",
  timeout: "时间到",
};

class ChallengeController {
  constructor() {
    this.root = document.getElementById("challenge");
    this.nodes = Object.fromEntries(Array.from(this.root.querySelectorAll("[id]"), node => [node.id, node]));
    this.scene = new ChallengeScene(this.get("canvas"));
    this.audio = new ChallengeAudio();
    this.held = new Map();
    this.targetButtons = new Map();
    this.forkButtons = Array.from(this.root.querySelectorAll("[data-fork]"));
    this.toolButtons = Array.from(this.root.querySelectorAll("[data-tool]"));
    this.targetLayer = this.root.querySelector(".challenge-targets");
    this.frame = 0;
    this.lastTime = null;
    this.paused = false;
    this.mode = "ready";
    this.selected = "right";
    this.selectedTool = null;
    this.round = null;
    this.lastBeat = -1;

    for (const button of this.forkButtons) button.addEventListener("click", () => this.selectFork(button.dataset.fork));
    for (const button of this.toolButtons) {
      button.addEventListener("click", () => {
        this.selectedTool = this.selectedTool === button.dataset.tool ? null : button.dataset.tool;
        this.refreshTools();
      });
    }
    this.get("begin").addEventListener("click", () => this.begin(54));
    this.get("fast").addEventListener("click", () => this.begin(38));
    this.get("pause").addEventListener("click", () => this.togglePause());
    this.get("sound").addEventListener("click", async () => {
      await this.audio.toggle();
      this.get("sound").textContent = "节拍音：" + (this.audio.enabled ? "开" : "关");
      this.get("sound").setAttribute("aria-pressed", String(this.audio.enabled));
      if (this.audio.enabled && this.isOpen()) this.audio.cue(430);
    });
    this.targetLayer.addEventListener("click", event => {
      const button = event.target.closest("button[data-target]");
      if (button) this.hit(button.dataset.side, button.dataset.target);
    });
    document.addEventListener("keydown", event => this.keyDown(event));
    document.addEventListener("keyup", event => {
      if (this.held.delete(event.code || event.key)) this.refreshTools();
    });
    window.addEventListener("blur", () => this.clearTools());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.isOpen() && this.mode === "play" && !this.paused) this.togglePause();
    });
  }

  get(name) {
    return this.nodes["challenge-" + name];
  }

  isOpen() {
    return document.body.dataset.page === "challenge";
  }

  stop() {
    if (this.frame) window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastTime = null;
    this.clearTools();
  }

  open() {
    this.stop();
    this.round = new ChallengeRound(54);
    this.mode = "ready";
    this.selected = "right";
    this.scene.front.left = 0;
    this.scene.front.right = 0;
    this.paused = false;
    this.get("pause").textContent = "暂停";
    this.get("pause").setAttribute("aria-pressed", "false");
    this.get("results").hidden = true;
    this.get("card-title").textContent = "准备接管复制叉";
    this.get("card-copy").textContent = "按住 A、T、C 或 G，点击新链末端的光圈。用 Q / E 切换左右叉，也可以直接点下方工具选中后再点击位点。";
    this.get("overlay").hidden = false;
    this.feedback("右叉先热身，完成两个位点后解锁左叉。");
    showPage("challenge", "challenge-title");
    this.refresh();
    this.queue();
  }

  begin(seconds) {
    this.round = new ChallengeRound(seconds, this.scene.reducedMotion ? 500 : 1250);
    this.mode = "play";
    this.paused = false;
    this.selected = "right";
    this.lastBeat = -1;
    this.scene.front.left = 0;
    this.scene.front.right = 0;
    this.lastTime = null;
    this.clearTools();
    this.get("overlay").hidden = true;
    this.get("title").focus({ preventScroll: true });
    this.feedback("解旋酶正往两侧打开 DNA。先接管右叉。");
    this.refresh();
    this.queue();
  }

  feedback(text, kind = "hint") {
    this.get("feedback").textContent = text;
    this.get("feedback").dataset.kind = kind;
  }

  togglePause() {
    if (this.mode !== "play" && this.mode !== "division") return;
    this.paused = !this.paused;
    this.lastTime = null;
    this.clearTools();
    const button = this.get("pause");
    button.textContent = this.paused ? "继续" : "暂停";
    button.setAttribute("aria-pressed", String(this.paused));
    this.feedback(this.paused ? "已暂停，点「继续」返回挑战。" : "挑战继续");
    this.refresh();
  }

  selectFork(side) {
    if (this.mode !== "play" || this.paused || infoDialog.open || !this.round.active(side)) return;
    this.selected = side;
    this.refresh();
  }

  tool() {
    return [...this.held.values()].at(-1) || this.selectedTool;
  }

  clearTools() {
    this.held.clear();
    this.selectedTool = null;
    this.refreshTools();
  }

  refreshTools() {
    for (const button of this.toolButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.tool === this.tool()));
    }
  }

  keyDown(event) {
    if (!this.isOpen() || this.mode !== "play" || this.paused || infoDialog.open ||
        event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toUpperCase();
    if (key === "Q" || key === "E") {
      event.preventDefault();
      this.selectFork(key === "Q" ? "left" : "right");
      return;
    }
    const tool = Object.hasOwn(BASE, key) ? key : key === "F" ? "enzyme" : key === "SHIFT" ? "repair" : null;
    if (tool) {
      event.preventDefault();
      this.held.set(event.code || event.key, tool);
      this.refreshTools();
    }
  }

  hit(side, id) {
    if (this.mode !== "play" || this.paused || infoDialog.open) return;
    if (side !== this.selected) {
      this.selectFork(side);
      this.feedback("已接管" + CHALLENGE_LAYOUT[side].name + "，选择工具后再点位点。");
      return;
    }
    const result = this.round.apply(side, id, this.tool());
    this.feedback(result.text, result.kind);
    if (result.kind === "correct") this.audio.cue(this.round.event?.kind === "seal" ? 740 : 540);
    if (result.kind === "mismatch") this.audio.cue(165, .13);
    if (this.round.stage === "sealed") {
      this.mode = "sealed";
      this.clearTools();
    }
    this.refresh();
    this.placeTargets();
  }

  refresh() {
    const round = this.round;
    this.get("phase").textContent = this.mode === "ready" ? "DNA 复制起点" : challengeLabels[round.stage];
    this.get("progress").textContent = round.pairs + " / 16";
    this.get("score").textContent = String(round.score);
    this.get("pause").disabled = this.mode !== "play" && this.mode !== "division";
    for (const button of this.forkButtons) {
      const side = button.dataset.fork;
      button.disabled = this.mode !== "play" || this.paused || !round.active(side);
      button.setAttribute("aria-pressed", String(side === this.selected));
      button.dataset.hasTarget = String(round.targets(side).length > 0);
    }
    for (const button of this.toolButtons) button.disabled = this.mode !== "play" || this.paused;
    this.refreshTools();
  }

  placeTargets() {
    const targets = this.mode === "play" && !this.paused && !infoDialog.open
      ? Object.keys(CHALLENGE_LAYOUT).flatMap(side => this.scene.narrow && side !== this.selected ? [] : this.round.targets(side))
      : [];
    const visible = new Set();
    for (const target of targets) {
      if (this.scene.front[target.side] - challengeDistance(target.index) < 38) continue;
      visible.add(target.id);
      let button = this.targetButtons.get(target.id);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "challenge-target";
        button.dataset.target = target.id;
        button.dataset.side = target.side;
        this.targetButtons.set(target.id, button);
        this.targetLayer.append(button);
      }
      button.hidden = false;
      const x = this.scene.project(target);
      button.style.transform = "translate(" + Math.round(x.x) + "px, " + Math.round(x.y) + "px) translate(-50%, -50%)";
      button.dataset.kind = target.kind;
      button.dataset.selected = String(target.side === this.selected);
      const name = target.kind === "pair" ? "模板 " + target.template
        : target.kind === "repair" ? target.wrong + " · 校对"
        : target.kind === "primer" ? "引物" : "接合";
      if (button.textContent !== name) button.textContent = name;
      const lane = target.lane === "leading" ? "前导链" : "后随链";
      button.setAttribute("aria-label", CHALLENGE_LAYOUT[target.side].name + " " + lane + " " + name);
    }
    for (const [id, button] of this.targetButtons) button.hidden = !visible.has(id);
  }

  queue() {
    if (!this.frame) this.frame = window.requestAnimationFrame(time => this.tick(time));
  }

  tick(time) {
    this.frame = 0;
    if (!this.isOpen()) return;
    const delta = this.lastTime === null ? 0 : time - this.lastTime;
    this.lastTime = time;
    const canAdvance = !this.paused && !infoDialog.open;
    if (canAdvance && (this.mode === "play" || this.mode === "sealed" || this.mode === "division")) this.round.advance(delta);
    if (this.round.stage === "division" && this.mode === "sealed") {
      this.mode = "division";
      this.feedback("局部复制完成。镜头跳到分裂期，观察染色体如何被分配。");
      this.refresh();
    }
    if (this.round.stage === "timeout" || this.round.stage === "complete") this.end();
    const seconds = Math.ceil(this.round.remaining / 1000);
    const clockText = seconds + "″";
    if (this.get("clock").textContent !== clockText) this.get("clock").textContent = clockText;
    this.get("clock").classList.toggle("urgent", seconds <= 10 && this.mode === "play");
    const beat = Math.floor(this.round.elapsed / CHALLENGE_BEAT);
    const pulse = this.mode === "play" && canAdvance && this.round.beatDistance() <= .16;
    this.get("beat").classList.toggle("pulse", pulse);
    this.root.classList.toggle("on-beat", pulse);
    if (this.mode === "play" && canAdvance && beat !== this.lastBeat) {
      this.lastBeat = beat;
      this.audio.cue(beat % 4 === 0 ? 360 : 235, .052, .026);
    }
    if (this.scene.draw(this.round, this.selected, this.mode, Math.min(delta, 64))) this.placeTargets();
    if (this.mode === "play") {
      for (const button of this.forkButtons) button.dataset.hasTarget = String(this.round.targets(button.dataset.fork).length > 0);
    }
    if (this.mode !== "complete" && this.mode !== "timeout") this.queue();
  }

  end() {
    this.mode = this.round.stage;
    const won = this.mode === "complete";
    this.clearTools();
    this.refresh();
    this.get("card-title").textContent = won ? "双叉接力完成" : "本轮时间到";
    this.get("card-copy").textContent = won
      ? "两个复制叉完成练习片段。稍后进入有丝分裂的细胞把姐妹染色单体分配到两侧。"
      : "可以优先处理各叉的前导链，提前露出后随链合成所需的模板。";
    const stats = [
      ["总分", this.round.score],
      ["已配对", this.round.pairs + " / 16"],
      ["首答正确", this.round.firstCorrect],
      ["完成校对", this.round.repairs],
      ["踩拍", this.round.beats],
      ["最长连击", this.round.bestStreak],
    ];
    this.get("results").innerHTML = stats.map(([label, value]) => "<div><dt>" + label + "</dt><dd>" + value + "</dd></div>").join("");
    this.get("results").hidden = false;
    this.get("overlay").hidden = false;
    this.get("begin").focus({ preventScroll: true });
  }
}

const challenge = new ChallengeController();
