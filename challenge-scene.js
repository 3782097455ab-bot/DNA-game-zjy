const CHALLENGE_WIDTH = 1160;
const CHALLENGE_HEIGHT = 448;
const CHALLENGE_CENTER = CHALLENGE_WIDTH / 2;
const CHALLENGE_MID = 229;

function challengeDistance(index) {
  return 116 + 68 * index;
}

class ChallengeScene extends ReplicationScene {
  constructor(canvas) {
    super(canvas);
    this.front = { left: 0, right: 0 };
  }

  x(side, distance) {
    return CHALLENGE_CENTER + CHALLENGE_LAYOUT[side].direction * distance;
  }

  top(side, lane) {
    return (side === "right") === (lane === "leading");
  }

  template(side, lane, distance) {
    const front = this.front[side];
    const opened = ease((front - distance + 16) / 102);
    const tail = Math.max(0, distance - front);
    const twist = (10 + 37 * ease(tail / 90)) * Math.cos(tail * Math.PI / 63);
    const lift = 102 * opened + twist * (1 - opened);
    return CHALLENGE_MID + (this.top(side, lane) ? -lift : lift);
  }

  daughter(side, lane, distance) {
    return this.template(side, lane, distance) + (this.top(side, lane) ? 58 : -58);
  }

  point(target) {
    const distance = challengeDistance(target.index) + (target.kind === "primer" ? 22 : 0);
    return { x: this.x(target.side, distance), y: this.daughter(target.side, target.lane, distance) };
  }

  project(target) {
    const point = this.point(target);
    return { x: this.offsetX + point.x * this.scale, y: this.offsetY + point.y * this.scale };
  }

  strand(side, start, end, lane, inherited, color, light) {
    const first = this.x(side, start);
    const last = this.x(side, end);
    const ordinate = x => (inherited ? this.template : this.daughter)
      .call(this, side, lane, Math.abs(x - CHALLENGE_CENTER));
    this.rail(Math.min(first, last), Math.max(first, last), ordinate, color, light);
  }

  setup(selected, division) {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return false;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.narrow = width < 720 && !division;
    const viewWidth = this.narrow ? 585 : division ? 770 : CHALLENGE_WIDTH;
    const viewLeft = division ? (CHALLENGE_WIDTH - viewWidth) / 2
      : this.narrow && selected === "right" ? CHALLENGE_CENTER - 7 : 0;
    this.scale = Math.min(width / viewWidth, height / CHALLENGE_HEIGHT);
    this.offsetX = (width - viewWidth * this.scale) / 2 - viewLeft * this.scale;
    this.offsetY = (height - CHALLENGE_HEIGHT * this.scale) / 2;
    const ctx = this.ctx;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return true;
  }

  paintParent(side) {
    const front = this.front[side];
    for (let d = 15; d <= 539; d += 19) {
      const a = this.template(side, "leading", d);
      const b = this.template(side, "lagging", d);
      const split = ease((front - d) / 76);
      const center = (a + b) / 2;
      const x = this.x(side, d);
      if (split < .99) {
        this.line(x, a, x, a + (center - a) * (1 - split), "#56928f", 3.5);
        this.line(x, b, x, b + (center - b) * (1 - split), "#9caa83", 3.5);
      }
    }
    this.strand(side, 0, 540, "lagging", true, "#306c75", "#66b8af");
    this.strand(side, 0, 540, "leading", true, "#408e93", OLD_LIGHT);

    if (front > 60) {
      const forkX = this.x(side, front);
      this.paintEnzyme(forkX, CHALLENGE_MID, "helicase");
      this.text("解旋酶", forkX, CHALLENGE_MID + 48, { size: 14, color: "#9cc6bc", align: "center" });
    }
    for (let i = 0; i < CHALLENGE_SITES; i += 1) {
      const d = challengeDistance(i);
      if (front - d < 38) break;
      for (const lane of ["leading", "lagging"]) {
        const sign = this.top(side, lane) ? 1 : -1;
        const template = CHALLENGE_LAYOUT[side].sequence[i];
        const base = lane === "leading" ? template : BASE[template].partner;
        const x = this.x(side, d);
        const y = this.template(side, lane, d);
        this.line(x, y, x, y + sign * 10, "#84c9bc", 2);
        this.baseGlyph(base, x, y + sign * 13, 11);
      }
    }
  }

  paintPair(side, lane, index) {
    const d = challengeDistance(index);
    const x = this.x(side, d);
    const sign = this.top(side, lane) ? 1 : -1;
    const y = this.template(side, lane, d);
    const daughterY = this.daughter(side, lane, d);
    const base = CHALLENGE_LAYOUT[side].sequence[index];
    const template = lane === "leading" ? base : BASE[base].partner;
    this.drawBond(template, x, y + sign * 9, daughterY - sign * 4);
    this.baseGlyph(BASE[template].partner, x, daughterY, 10);
  }

  paintDaughters(side, fork, time) {
    if (this.front[side] < 110) return;
    const first = challengeDistance(0);
    const primersReplaced = fork.replaceAt !== null && time >= fork.replaceAt;
    this.strand(side, first - 45, first - 18, "leading", false,
      primersReplaced ? "#a67237" : "#665887", primersReplaced ? GOLD : PRIMER);
    if (fork.leading.count) {
      this.strand(side, first - 18, challengeDistance(fork.leading.count - 1) + 12, "leading", false, "#a67237", GOLD);
    }
    for (let i = 0; i < fork.leading.count; i += 1) this.paintPair(side, "leading", i);

    fork.fragments.forEach((fragment, index) => {
      if (!fragment.primed) return;
      const maxIndex = (index + 1) * FRAGMENT_LENGTH - 1;
      const end = challengeDistance(maxIndex) + 14;
      this.strand(side, end, end + 19, "lagging", false,
        primersReplaced ? "#a67237" : "#665887", primersReplaced ? GOLD : PRIMER);
      if (fragment.count) {
        this.strand(side, challengeDistance(maxIndex + 1 - fragment.count) - 12, end, "lagging", false, "#a67237", GOLD);
      }
      for (let i = 0; i < fragment.count; i += 1) this.paintPair(side, "lagging", maxIndex - i);
    });
    if (fork.sealedAt !== null) {
      const start = challengeDistance(FRAGMENT_LENGTH - 1) + 33;
      const end = challengeDistance(FRAGMENT_LENGTH) - 12;
      this.strand(side, start, end, "lagging", false, "#a67237", GOLD);
    }
  }

  paintForkLabels(side, selected) {
    const direction = CHALLENGE_LAYOUT[side].direction;
    const name = CHALLENGE_LAYOUT[side].name;
    this.text(name, this.x(side, 262), 41, {
      color: selected ? "#d3ebe3" : "#92afa9", size: 24, weight: 650, align: "center",
    });
    const forward = this.x(side, 327);
    const near = this.x(side, 362);
    const far = this.x(side, 434);
    this.arrow(near, 407, far, 407, "#93bfb4");
    this.text("复制叉移动", forward, 407, { color: "#9bb5b1", size: 15, align: direction === 1 ? "right" : "left" });

    for (const lane of ["leading", "lagging"]) {
      const leading = lane === "leading";
      const y = this.top(side, lane) ? 86 : 374;
      const start = this.x(side, leading ? 135 : 247);
      const end = this.x(side, leading ? 247 : 135);
      const label = this.x(side, 272);
      this.arrow(start, y, end, y, "#edbd7f");
      this.text("5′", start - Math.sign(end - start) * 19, y, { size: 15, color: GOLD, align: "center" });
      this.text("3′", end + Math.sign(end - start) * 19, y, { size: 15, color: GOLD, align: "center" });
      this.text(leading ? "前导链 · 连续" : "后随链 · 分段", label + direction * 28, y, {
        size: 15, color: "#c8d7c7", align: direction === 1 ? "left" : "right",
      });
    }
  }

  paintEvent(event, time) {
    if (!event || this.reducedMotion) return;
    const progress = clamp((time - event.at) / 430);
    if (progress >= 1) return;
    const point = this.point(event);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    const color = event.kind === "mismatch" ? "#ff9381" : GOLD;
    this.circle(point.x, point.y, 11 + ease(progress) * 36, null, color, 2);
    if (event.kind === "paired" || event.kind === "repair") {
      const base = event.base || event.wrong;
      const direction = CHALLENGE_LAYOUT[event.side].direction;
      this.baseGlyph(base, point.x + direction * (event.kind === "paired" ? 28 * (1 - progress) : -64 * progress),
        point.y + (event.kind === "paired" ? 22 * (1 - progress) : 43 * progress), 12, true);
    }
    ctx.restore();
  }

  paintDivision(elapsed) {
    const ctx = this.ctx;
    const t = this.reducedMotion ? 6000 : elapsed;
    const split = ease((t - 1750) / 2000);
    const membraneSplit = ease((t - 3500) / 1700);
    const left = CHALLENGE_CENTER - 181 * membraneSplit;
    const right = CHALLENGE_CENTER + 181 * membraneSplit;
    const y = 232;
    const cell = (x, radius, alpha) => {
      const gradient = ctx.createRadialGradient(x - 31, y - 32, 10, x, y, radius);
      gradient.addColorStop(0, "#43878c85");
      gradient.addColorStop(.74, "#184552bf");
      gradient.addColorStop(1, "#2d737774");
      ctx.save();
      ctx.globalAlpha = alpha;
      this.circle(x, y, radius, gradient, "#80cfba92", 2.4);
      this.circle(x, y, radius - 16, null, "#83c5b02c", 1.2);
      ctx.restore();
    };

    cell(CHALLENGE_CENTER, 146 + split * 24, 1 - membraneSplit);
    cell(left, 124, membraneSplit);
    cell(right, 124, membraneSplit);

    for (const [index, color] of ["#86ddc6", "#e5b16d"].entries()) {
      const centerY = y - 42 + index * 84;
      for (const side of [-1, 1]) {
        const x = CHALLENGE_CENTER + side * (split * 94 + membraneSplit * 87);
        const endOffset = side * (1 - split) * 26;
        const length = index === 0 ? 28 : 22;
        const pole = CHALLENGE_CENTER + side * 115;
        if (membraneSplit < .98) this.line(pole, y, x, centerY, "#b9d7c460", 1.2);
        if (membraneSplit > .01) this.circle(x, y, 77, null, "#93b4ab45", 1.4);
        ctx.beginPath();
        ctx.moveTo(x + endOffset, centerY - length);
        ctx.quadraticCurveTo(x - side * 16, centerY - 8, x, centerY);
        ctx.quadraticCurveTo(x - side * 16, centerY + 8, x + endOffset, centerY + length);
        ctx.lineWidth = 12;
        ctx.strokeStyle = color;
        ctx.stroke();
        this.circle(x, centerY, 3.6, "#f7dbc1");
      }
    }
    const message = t < 1750 ? "复制后的染色体在细胞中央排列"
      : t < 3500 ? "姐妹染色单体移向两极"
      : "胞质分开 · 两个子细胞各得一套染色体";
    this.text(message, CHALLENGE_CENTER, 421, { size: 25, color: "#d4e9df", align: "center" });
  }

  draw(round, selected, mode, delta) {
    if (!this.ctx) return false;
    const division = mode === "division" || mode === "complete";
    if (!this.setup(selected, division)) return false;
    const ctx = this.ctx;
    const glow = ctx.createRadialGradient(CHALLENGE_CENTER, CHALLENGE_MID, 30, CHALLENGE_CENTER, CHALLENGE_MID, 610);
    glow.addColorStop(0, "#2962706e");
    glow.addColorStop(1, "#0a202500");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CHALLENGE_WIDTH, CHALLENGE_HEIGHT);
    if (division) {
      this.paintDivision(round.elapsed - round.divisionAt);
      return true;
    }

    this.line(CHALLENGE_CENTER, 64, CHALLENGE_CENTER, 390, "#a3c5b034");
    this.text("复制起点", CHALLENGE_CENTER, 35, { color: "#8fb0a4", size: 15, align: "center" });
    for (const side of Object.keys(CHALLENGE_LAYOUT)) {
      const leading = round.fork[side].leading.count;
      const distance = mode === "ready" ? 0 : challengeDistance(Math.min(leading, CHALLENGE_SITES - 1)) + 64;
      const goal = distance * ease(round.elapsed / round.opening);
      const amount = this.reducedMotion ? 1 : 1 - Math.exp(-delta / 120);
      this.front[side] += (goal - this.front[side]) * amount;
      ctx.save();
      ctx.globalAlpha = side === selected ? 1 : .72;
      this.paintParent(side);
      this.paintDaughters(side, round.fork[side], round.elapsed);
      this.paintForkLabels(side, side === selected);
      for (const target of round.targets(side)) {
        if (target.kind !== "pair" && target.kind !== "repair") continue;
        const d = challengeDistance(target.index);
        if (this.front[side] - d < 38) continue;
        const x = this.x(side, d);
        const sign = this.top(side, target.lane) ? 1 : -1;
        const y = this.template(side, target.lane, d);
        this.circle(x, y + sign * 13, 16, null, "#f0b66b79", 1.35);
        this.line(x, y + sign * 26, x, this.daughter(side, target.lane, d), "#edbd7f8c", 1.15);
      }
      ctx.restore();
    }
    this.paintEvent(round.event, round.elapsed);
    return true;
  }
}
