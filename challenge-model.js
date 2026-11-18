const CHALLENGE_SITES = 4;
const FRAGMENT_LENGTH = 2;
const CHALLENGE_BEAT = 640;
const CHALLENGE_LAYOUT = {
  left: { direction: -1, name: "左叉", sequence: "GTCA" },
  right: { direction: 1, name: "右叉", sequence: "AGTC" },
};

class ChallengeRound {
  constructor(seconds, opening = 1250) {
    this.duration = seconds * 1000;
    this.opening = opening;
    this.elapsed = 0;
    this.remaining = this.duration;
    this.stage = "warmup";
    this.score = 0;
    this.pairs = 0;
    this.firstCorrect = 0;
    this.repairs = 0;
    this.beats = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.fork = Object.fromEntries(Object.keys(CHALLENGE_LAYOUT).map(id => [id, {
      leading: { count: 0, repair: null, retry: false },
      fragments: Array.from({ length: CHALLENGE_SITES / FRAGMENT_LENGTH }, () => ({
        primed: false, count: 0, repair: null, retry: false,
      })),
      replaceAt: null,
      sealedAt: null,
    }]));
    this.event = null;
  }

  get copying() {
    return this.stage === "warmup" || this.stage === "dual";
  }

  advance(ms) {
    this.elapsed += ms;
    if (this.copying) {
      this.remaining = Math.max(0, this.duration - Math.max(0, this.elapsed - this.opening));
      if (this.remaining === 0) this.stage = "timeout";
    } else if (this.stage === "sealed" && this.elapsed - this.lastSealAt >= 780) {
      this.stage = "division";
      this.divisionAt = this.elapsed;
    } else if (this.stage === "division" && this.elapsed - this.divisionAt >= 6400) {
      this.stage = "complete";
    }
  }

  active(side) {
    return this.stage !== "warmup" || side === "right";
  }

  beatDistance() {
    const progress = (this.elapsed % CHALLENGE_BEAT) / CHALLENGE_BEAT;
    return Math.min(progress, 1 - progress);
  }

  targets(side) {
    if (!this.copying || this.elapsed < this.opening || !this.active(side)) return [];
    const fork = this.fork[side];
    const { sequence } = CHALLENGE_LAYOUT[side];
    const targets = [];
    const candidate = (lane, track, index, template) => ({
      id: side + "-" + lane,
      side, lane, index, kind: track.repair ? "repair" : "pair",
      track, template, wrong: track.repair,
    });

    if (fork.leading.count < CHALLENGE_SITES) {
      const index = fork.leading.count;
      targets.push(candidate("leading", fork.leading, index, sequence[index]));
    }

    const segment = fork.fragments.findIndex(fragment => fragment.count < FRAGMENT_LENGTH);
    if (segment >= 0 && fork.leading.count >= (segment + 1) * FRAGMENT_LENGTH) {
      const fragment = fork.fragments[segment];
      const index = (segment + 1) * FRAGMENT_LENGTH - 1 - fragment.count;
      const template = BASE[sequence[index]].partner;
      targets.push(fragment.primed
        ? candidate("lagging", fragment, index, template)
        : { id: side + "-lagging", side, lane: "lagging", kind: "primer", track: fragment, index });
    }

    if (fork.replaceAt !== null && fork.sealedAt === null && this.elapsed >= fork.replaceAt) {
      targets.push({ id: side + "-lagging", side, lane: "lagging", kind: "seal", index: FRAGMENT_LENGTH - .5 });
    }
    return targets;
  }

  apply(side, id, tool) {
    const target = this.targets(side).find(item => item.id === id);
    if (!target) return { text: "等待下一个位点出现", kind: "hint" };
    if (target.kind === "repair") {
      if (tool !== "repair") return { text: "按住 Shift 聚焦，再点一下错配末端", kind: "hint" };
      target.track.repair = null;
      target.track.retry = true;
      this.repairs += 1;
      this.event = { ...target, at: this.elapsed, kind: "repair" };
      return { text: "校对移除了新链 3′ 端的错配，重新选入碱基", kind: "correct" };
    }
    if (target.kind === "primer" || target.kind === "seal") {
      if (tool !== "enzyme") return { text: "按住 F，再点酶位点", kind: "hint" };
      this.event = { ...target, at: this.elapsed };
      if (target.kind === "primer") {
        target.track.primed = true;
        this.score += 4;
        return { text: "RNA 引物已就位，从靠近叉口的一端向回延伸", kind: "correct" };
      }
      this.fork[side].sealedAt = this.elapsed;
      this.score += 8;
      if (Object.values(this.fork).every(fork => fork.sealedAt !== null)) {
        this.stage = "sealed";
        this.lastSealAt = this.elapsed;
      }
      return { text: "连接酶封合 DNA 骨架上的缺口", kind: "correct" };
    }
    if (!Object.hasOwn(BASE, tool)) return { text: "选中 A、T、C 或 G，再点发光的 3′ 位点", kind: "hint" };

    const matched = BASE[target.template].partner === tool;
    this.event = { ...target, base: tool, at: this.elapsed, kind: matched ? "paired" : "mismatch" };
    if (!matched) {
      target.track.repair = tool;
      target.track.retry = true;
      this.streak = 0;
      return { text: "末端错配 · 按住 Shift 校对", kind: "mismatch" };
    }

    const firstTry = !target.track.retry;
    const onBeat = this.beatDistance() <= .16;
    const points = (firstTry ? 10 : 6) + (onBeat ? 2 : 0);
    this.pairs += 1;
    if (firstTry) {
      this.firstCorrect += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    }
    if (onBeat) this.beats += 1;
    this.score += points;
    target.track.count += 1;
    target.track.retry = false;
    const fork = this.fork[side];
    if (fork.replaceAt === null && fork.fragments.every(fragment => fragment.count === FRAGMENT_LENGTH)) {
      fork.replaceAt = this.elapsed + 600;
    }

    if (this.stage === "warmup" && this.fork.right.leading.count === 2) {
      this.stage = "dual";
      const leftFirstBase = CHALLENGE_LAYOUT.left.sequence[0];
      this.fork.left.leading.repair = leftFirstBase;
      return { text: "双叉接管 · 左叉有一处待校对末端，按 Q 切换", kind: "correct" };
    }
    return { text: target.template + "–" + tool + " · +" + points + (onBeat ? " · 正中节拍" : ""), kind: "correct" };
  }
}
