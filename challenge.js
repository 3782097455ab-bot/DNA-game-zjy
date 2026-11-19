class ChallengeAudio {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.voices = new Set();
    this.scheduledBeat = -1;
  }

  async toggle() {
    if (this.enabled) {
      this.enabled = false;
      this.reset();
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

  reset() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
    this.scheduledBeat = -1;
  }

  drum(strong, delay = 0) {
    if (!this.enabled || this.context.state !== "running") return;
    const start = this.context.currentTime + delay;
    const voice = this.context.createOscillator();
    const gain = this.context.createGain();
    voice.type = "sine";
    voice.frequency.setValueAtTime(strong ? 155 : 125, start);
    voice.frequency.exponentialRampToValueAtTime(48, start + .11);
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(strong ? .52 : .38, start + .004);
    gain.gain.exponentialRampToValueAtTime(.001, start + .18);
    voice.connect(gain);
    gain.connect(this.context.destination);
    this.voices.add(voice);
    voice.onended = () => {
      voice.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    voice.start(start);
    voice.stop(start + .2);
  }

  sync(elapsed) {
    if (!this.enabled) return;
    const current = Math.floor(elapsed / CHALLENGE_BEAT);
    const intoBeat = elapsed % CHALLENGE_BEAT;
    if (current > this.scheduledBeat && intoBeat < 95) {
      this.drum(current % 4 === 0);
      this.scheduledBeat = current;
    }
    const untilNext = CHALLENGE_BEAT - intoBeat;
    if (untilNext < 110 && current + 1 > this.scheduledBeat) {
      this.drum((current + 1) % 4 === 0, untilNext / 1000);
      this.scheduledBeat = current + 1;
    }
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

    for (const button of this.forkButtons) button.addEventListener("click", () => this.selectFork(button.dataset.fork));
    for (const button of this.toolButtons) {
      button.addEventListener("click", () => {
        this.selectedTool = this.selectedTool === button.dataset.tool ? null : button.dataset.tool;
        this.refreshTools();
      });
    }
    this.get("begin").addEventListener("click", () => this.begin(60));
    this.get("fast").addEventListener("click", () => this.begin(38));
    this.get("pause").addEventListener("click", () => this.togglePause());
    this.get("sound").addEventListener("click", async () => {
      await this.audio.toggle();
      this.get("sound").textContent = "节拍音：" + (this.audio.enabled ? "开" : "关");
      this.get("sound").setAttribute("aria-pressed", String(this.audio.enabled));
      if (this.audio.enabled && this.isOpen()) {
        if (this.mode === "play" && !this.paused) this.audio.sync(this.round.elapsed);
        else this.audio.drum(true);
      }
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
    this.audio.reset();
    this.clearTools();
  }

  open() {
    this.stop();
    this.round = new ChallengeRound(60);
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
    this.audio.reset();
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
    this.get("guide").dataset.kind = kind;
  }

  togglePause() {
    if (this.mode !== "play" && this.mode !== "division") return;
    this.paused = !this.paused;
    this.lastTime = null;
    this.audio.reset();
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

  refreshGuide() {
    const targets = this.round.targets(this.selected);
    const target = targets.find(item => item.kind === "repair") || targets[0];
    const side = CHALLENGE_LAYOUT[this.selected].name;
    const actions = {
      pair: ["选择互补碱基", "按住 A / T / C / G，再点发光的 3′ 端光圈。"],
      repair: ["校对错配末端", "按住 Shift，再点红色光圈，移除错配后重新配对。"],
      primer: ["放置 RNA 引物", "按住 F，再点紫色「引物」位点，启动这一段新链。"],
      seal: ["连接冈崎片段", "按住 F，再点青色「接合」位点，封合 DNA 骨架。"],
    };
    let title = "准备接管复制叉";
    let instruction = "Q / E 切换左右叉，键盘选工具，鼠标点位点。";
    if (this.paused) {
      title = "挑战已暂停";
      instruction = "点击右上方「继续」返回挑战，计时将从暂停处继续。";
    } else if (this.mode === "division" || this.mode === "complete") {
      title = "观察染色体分配";
      instruction = "姐妹染色单体移向两极，两个子细胞各获得一套染色体。";
    } else if (this.mode === "timeout") {
      title = "本轮挑战结束";
      instruction = "可以再试标准档，或回到基础练习熟悉配对。";
    } else if (this.mode === "sealed") {
      title = "DNA 片段已接合";
      instruction = "接下来镜头将跳到细胞分裂期。";
    } else if (this.mode === "play" && target) {
      [title, instruction] = actions[target.kind];
      title = side + " · " + title;
    } else if (this.mode === "play") {
      title = this.round.elapsed < this.round.opening ? "双链正在解旋" : side + " · 等待新位点";
      instruction = this.round.elapsed < this.round.opening
        ? "先接管右叉。完成两个位点后，左叉也将解锁。"
        : "引物将被移除并补入 DNA。也可以先切换到另一个复制叉。";
    }
    if (this.get("guide-title").textContent !== title) this.get("guide-title").textContent = title;
    if (this.get("instruction").textContent !== instruction) this.get("instruction").textContent = instruction;
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
    if (this.round.stage === "sealed") {
      this.mode = "sealed";
      this.audio.reset();
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
    this.refreshGuide();
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
    this.refreshGuide();
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
    const pulse = this.mode === "play" && canAdvance && this.round.beatDistance() <= .16;
    this.get("beat").classList.toggle("pulse", pulse);
    this.root.classList.toggle("on-beat", pulse);
    if (this.mode === "play" && canAdvance) this.audio.sync(this.round.elapsed);
    else this.audio.reset();
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
