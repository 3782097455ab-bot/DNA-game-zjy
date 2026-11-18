const BASE = Object.freeze({
  A: { name: "腺嘌呤", partner: "T", purine: true, color: "#7bdcc7" },
  T: { name: "胸腺嘧啶", partner: "A", purine: false, color: "#f3bc76" },
  C: { name: "胞嘧啶", partner: "G", purine: false, color: "#b8d69d" },
  G: { name: "鸟嘌呤", partner: "C", purine: true, color: "#aac8f6" },
});

const FORK_WIDTH = 1140;
const FORK_HEIGHT = 486;
const FORK_MID = 242;
const SITE_START = 151;
const SITE_SPACING = 80;
const OLD_LIGHT = "#78daca";
const GOLD = "#f0b66b";
const PRIMER = "#b5a0dd";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(value, max));
}

function ease(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function siteX(index) {
  return SITE_START + index * SITE_SPACING;
}

function pairType(template, selected) {
  if (BASE[template].partner === selected) return "correct";
  return BASE[template].purine === BASE[selected].purine ? "same" : "cross";
}

class ReplicationScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.reset();
  }

  reset() {
    this.fork = -70;
    this.zoom = 1;
    this.time = 0;
  }

  templateY(x, leading) {
    const opening = ease((this.fork - x) / 176);
    const twist = Math.max(0, x - this.fork);
    const wave = Math.cos(twist * Math.PI / 68);
    const swing = (7 + 44 * ease(twist / 94)) * wave;
    const rise = opening * (leading ? 139 : 128);
    const ripple = Math.sin(x / 138) * 6 * opening;
    const offset = rise + (1 - opening) * swing + ripple;
    return FORK_MID + (leading ? -offset : offset);
  }

  daughterY(x, leading) {
    return this.templateY(x, leading) + (leading ? 73 : -68);
  }

  curve(start, end, ordinate) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(start, ordinate(start));
    for (let x = start + 4; x < end; x += 4) ctx.lineTo(x, ordinate(x));
    ctx.lineTo(end, ordinate(end));
  }

  stroke(start, end, ordinate, color, width) {
    if (end <= start) return;
    const ctx = this.ctx;
    this.curve(start, end, ordinate);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  rail(start, end, ordinate, color, light) {
    this.stroke(start, end, ordinate, "#031216a6", 17);
    this.stroke(start, end, ordinate, color, 11);
    this.stroke(start, end, x => ordinate(x) - 2, light, 3.2);
  }

  line(x1, y1, x2, y2, color, width = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  text(message, x, y, { color = "#d8eae3", size = 18, align = "left", weight = 500 } = {}) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = weight + " " + size + "px " + '"Noto Sans SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(message, x, y);
  }

  arrow(x1, y1, x2, y2, color) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    this.line(x1, y1, x2, y2, color, 1.35);
    this.line(x2, y2, x2 - Math.cos(angle + .55) * 7, y2 - Math.sin(angle + .55) * 7, color, 1.35);
    this.line(x2, y2, x2 - Math.cos(angle - .55) * 7, y2 - Math.sin(angle - .55) * 7, color, 1.35);
  }

  circle(x, y, radius, fill, stroke, width = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  baseGlyph(base, x, y, radius, emphasis = false) {
    const ctx = this.ctx;
    const { purine, color } = BASE[base];
    const outline = purine
      ? [[-.94, -.6], [-.35, -.95], [.24, -.6], [.82, -.72], [1.12, 0], [.82, .72], [.24, .6], [-.35, .95], [-.94, .6]]
      : [[-1, 0], [-.5, -.86], [.5, -.86], [1, 0], [.5, .86], [-.5, .86]];
    ctx.beginPath();
    outline.forEach(([dx, dy], index) => {
      if (index === 0) ctx.moveTo(x + dx * radius, y + dy * radius);
      else ctx.lineTo(x + dx * radius, y + dy * radius);
    });
    ctx.closePath();
    ctx.fillStyle = emphasis ? color : "#102f38";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = emphasis ? 2 : 1.2;
    ctx.stroke();
    if (purine && !emphasis) {
      this.line(x + .24 * radius, y - .6 * radius, x + .24 * radius, y + .6 * radius, color + "55");
    }
    this.text(base, x - (purine ? .08 * radius : 0), y, {
      size: radius * 1.18, color: emphasis ? "#08252b" : color, align: "center", weight: 700,
    });
  }

  paintUnopened() {
    for (let x = 66; x < 1081; x += 22) {
      const a = this.templateY(x, true);
      const b = this.templateY(x, false);
      const open = ease((this.fork - x) / 118);
      const center = (a + b) / 2;
      if (open < .99) {
        this.line(x, a, x, a + (center - a) * (1 - open), "#82c6b9a8", 4.2);
        this.line(x, b, x, b + (center - b) * (1 - open), "#d4a470ac", 4.2);
      }
    }

    this.rail(52, 1092, x => this.templateY(x, false), "#27636b", "#58a99e");
    this.rail(52, 1092, x => this.templateY(x, true), "#3f9b9f", OLD_LIGHT);
  }

  drawBond(base, x, oldY, newY) {
    const count = base === "G" || base === "C" ? 3 : 2;
    const near = Math.sign(newY - oldY) * 17;
    const ctx = this.ctx;
    ctx.setLineDash([2.7, 3.5]);
    for (let i = 0; i < count; i += 1) {
      const dashX = x + (i - (count - 1) / 2) * 4.2;
      this.line(dashX, oldY + near, dashX, newY - near, "#d9d7a4a0", 1.05);
    }
    ctx.setLineDash([]);
  }

  paintDaughters(round, time) {
    const finished = round.pairs.length;
    const replaced = round.replaceAt != null && time >= round.replaceAt;
    const joined = round.joinAt != null && time >= round.joinAt;
    const leadingPath = x => this.daughterY(x, true);
    const laggingPath = x => this.daughterY(x, false);
    if (this.fork > SITE_START + 64) {
      const primerStart = SITE_START - 46;
      const primerEnd = SITE_START - 23;
      this.rail(primerStart, primerEnd, leadingPath, replaced ? "#977042" : "#71648f", replaced ? GOLD : PRIMER);
      if (finished) this.rail(primerEnd, siteX(finished - 1) + 12, leadingPath, "#a57539", GOLD);
    }

    for (let i = 0; i < finished; i += 1) {
      const x = siteX(i);
      const oldBase = round.sequence[i];
      const y = this.templateY(x, true);
      this.drawBond(oldBase, x, y + 12, leadingPath(x) - 9);
      this.baseGlyph(BASE[oldBase].partner, x, leadingPath(x) - 9, 10);
    }

    for (let i = 0; i < round.fragments.length; i += 1) {
      const fragment = round.fragments[i];
      const progress = this.reducedMotion ? 1 : ease((time - fragment.at) / 680);
      const left = siteX(fragment.start) - 29;
      const right = siteX(fragment.end) + 28;
      const primerStart = right - 18;
      const growingEnd = primerStart + (left - primerStart) * progress;
      this.rail(growingEnd, primerStart, laggingPath, "#a57539", GOLD);
      this.rail(primerStart, right, laggingPath, replaced ? "#a57539" : "#71648f", replaced ? GOLD : PRIMER);
      if (joined && i) {
        const previousRight = siteX(round.fragments[i - 1].end) + 28;
        this.rail(previousRight, left, laggingPath, "#a57539", GOLD);
        const shine = 1 - clamp((time - round.joinAt) / 510);
        if (shine > 0) {
          const joinX = (previousRight + left) / 2;
          this.circle(joinX, laggingPath(joinX), 7 + 8 * (1 - shine), null, "#ffdc9f" + Math.round(shine * 185).toString(16).padStart(2, "0"), 2);
        }
      }

      for (let j = fragment.end; j >= fragment.start; j -= 1) {
        const x = siteX(j);
        if (x + .25 < growingEnd) continue;
        const otherTemplate = BASE[round.sequence[j]].partner;
        const oldY = this.templateY(x, false) - 13;
        this.drawBond(otherTemplate, x, oldY, laggingPath(x) + 8);
        this.baseGlyph(round.sequence[j], x, laggingPath(x) + 8, 9);
      }
      if (!joined && right - growingEnd > 39) {
        this.text("5′", right, laggingPath(right) - 20, { size: 15, color: PRIMER, align: "center" });
        this.text("3′", growingEnd, laggingPath(growingEnd) - 20, { size: 15, color: GOLD, align: "center" });
      }
    }
  }

  paintTemplateBases(round, time) {
    for (let i = 0; i < round.sequence.length; i += 1) {
      const x = siteX(i);
      if (this.fork - x < 85) break;
      const high = this.templateY(x, true);
      const low = this.templateY(x, false);
      const current = i === round.pairs.length && round.phase !== "intro";
      const pulse = this.reducedMotion ? 0 : Math.sin(time / 260) * 2.5;
      const radius = current ? 18 : 11;
      if (current) {
        this.circle(x, high + 16, 27 + pulse, "#ffd39213", "#eebb7c93", 1.5);
      }
      this.line(x, high, x, high + 14, "#78daca", 3);
      this.baseGlyph(round.sequence[i], x, high + 15, radius, current);
      this.line(x, low, x, low - 13, "#63aeb2", 3);
      this.baseGlyph(BASE[round.sequence[i]].partner, x, low - 14, 9);
    }
  }

  paintEnzyme(x, y, type, direction = 1) {
    const ctx = this.ctx;
    const helicase = type === "helicase";
    const width = helicase ? 25 : 33;
    const height = helicase ? 33 : 21;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(helicase ? -.2 : -.2 * direction);
    const glow = ctx.createRadialGradient(-width * .4, -height * .6, 4, 0, 0, width + 17);
    glow.addColorStop(0, helicase ? "#afd9d1" : "#b3b7dd");
    glow.addColorStop(.5, helicase ? "#377e7d" : "#676b9a");
    glow.addColorStop(1, helicase ? "#143f47" : "#303550");
    ctx.beginPath();
    ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
    if (helicase) {
      ctx.moveTo(11, 0);
      ctx.ellipse(0, 0, 11, 17, 0, 0, Math.PI * 2, true);
    }
    ctx.fillStyle = glow;
    ctx.strokeStyle = helicase ? "#9ad7cbbb" : "#a3acd28f";
    ctx.lineWidth = 1.4;
    ctx.fill("evenodd");
    ctx.stroke();
    ctx.restore();
  }

  paintMachinery(round) {
    if (this.fork < 83) return;
    const hx = this.fork + 8;
    this.paintEnzyme(hx, FORK_MID, "helicase");
    this.line(hx + 11, FORK_MID - 23, hx + 44, FORK_MID - 61, "#8cc7bd92");
    this.text("解旋酶", hx + 52, FORK_MID - 66, { size: 18, color: "#b9e8da" });

    const activeIndex = Math.min(round.pairs.length, round.sequence.length - 1);
    const activeX = siteX(activeIndex);
    if (this.fork - activeX > 95 && round.phase !== "intro") {
      const py = this.daughterY(activeX, true) + 12;
      const px = activeX - 18;
      this.paintEnzyme(px, py, "polymerase");
      this.line(px + 14, py + 16, px + 39, py + 34, "#b5abda9b");
      this.text("DNA 聚合酶", px + 46, py + 41, { size: 17, color: "#ccc6e1" });
    }

    const fragment = round.fragments.at(-1);
    if (fragment && this.time - fragment.at < 750 && !round.joined) {
      const amount = this.reducedMotion ? 1 : ease((this.time - fragment.at) / 680);
      const x = siteX(fragment.end) + (siteX(fragment.start) - siteX(fragment.end) - 24) * amount;
      this.paintEnzyme(x, this.daughterY(x, false) + 6, "polymerase", -1);
    }
  }

  paintAttempt(round, time) {
    const attempt = round.attempt;
    if (!attempt) return;
    const progress = clamp((time - attempt.at) / attempt.duration);
    const x = siteX(round.pairs.length);
    const py = this.templateY(x, true);
    const endY = this.daughterY(x, true) - 9;
    const rejection = attempt.kind !== "correct";
    const arrival = this.reducedMotion ? 1 : ease(progress / .61);
    const bounce = rejection && !this.reducedMotion ? ease((progress - .64) / .31) : 0;
    const targetX = x + 74 * (1 - arrival) + 32 * bounce;
    const targetY = endY + 53 * (1 - arrival) + 24 * bounce;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = rejection ? 1 - bounce * .85 : 1;
    this.baseGlyph(attempt.base, targetX, targetY, 16, true);
    if (arrival > .91) {
      if (rejection) {
        const tint = attempt.kind === "cross" ? "#f1c47cad" : "#ed8d819e";
        this.circle(x + 2, (endY + py) / 2 + 12, 15 + bounce * 10, null, tint, 1.6);
      } else {
        this.drawBond(attempt.base, x, py + 19, endY);
      }
    }
    ctx.restore();
  }

  annotations(round) {
    if (this.fork < SITE_START + 91) return;
    this.text("3′", 41, this.templateY(62, true) - 23, { color: OLD_LIGHT, size: 17 });
    this.text("5′", 41, this.templateY(62, false) + 26, { color: OLD_LIGHT, size: 17 });
    const upperEnd = this.templateY(1092, true);
    const lowerEnd = this.templateY(1092, false);
    const separation = Math.abs(upperEnd - lowerEnd) < 22 ? 12 : 0;
    this.text("5′", 1097, upperEnd - separation, { color: OLD_LIGHT, size: 17 });
    this.text("3′", 1097, lowerEnd + separation, { color: OLD_LIGHT, size: 17 });
    if (round.pairs.length) {
      const end = siteX(round.pairs.length - 1);
      this.text("5′", SITE_START - 68, this.daughterY(SITE_START - 40, true), { color: GOLD, size: 17 });
      this.text("3′", end + 19, this.daughterY(end, true) - 6, { color: GOLD, size: 17 });
    }

    if (round.phase === "intro") return;
    if (round.pairs.length < round.sequence.length) {
      const site = siteX(round.pairs.length);
      if (this.fork - site > 86) {
        const targetY = this.templateY(site, true) - 12;
        const sourceX = Math.max(24, site - 82);
        this.text("当前位点", sourceX - 2, 30, { size: 18, color: GOLD });
        this.arrow(sourceX, 47, site - 5, targetY, "#edbf7abb");
      }
    }
    if (round.fragments.length) {
      const left = SITE_START - 30;
      const last = round.fragments.at(-1);
      const right = siteX(last.end) + 28;
      const startedJoining = round.joinAt != null && this.time >= round.joinAt;
      this.line(left, 411, right, 411, "#a4b9b55e");
      this.line(left, 403, left, 412, "#a4b9b55e");
      this.line(right, 403, right, 412, "#a4b9b55e");
      this.text(startedJoining ? "连接酶封合片段间缺口" : "冈崎片段", (left + right) / 2, 434, {
        size: 18, color: startedJoining ? GOLD : "#acc3bf", align: "center",
      });
    }
    const arrowX = clamp(this.fork + 55, 400, 971);
    this.arrow(arrowX, 449, arrowX + 100, 449, "#a7d0c5ae");
    this.text("复制叉前进方向", arrowX, 470, { size: 14, color: "#a8c3bc" });
  }

  render(round, zoomed) {
    const ctx = this.ctx;
    if (!ctx) return;
    const dimensions = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(dimensions.width * pixelRatio);
    const height = Math.round(dimensions.height * pixelRatio);
    if (!width || !height) return;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const dt = Math.max(0, round.time - this.time);
    this.time = round.time;
    const active = Math.min(round.pairs.length, round.sequence.length - 1);
    const target = siteX(active) + (round.pairs.length === round.sequence.length ? 180 : 151);
    const intro = ease(round.time / round.introDuration);
    if (round.phase === "intro") {
      this.fork = this.reducedMotion ? target : -70 + (target + 70) * intro;
    } else {
      const amount = this.reducedMotion ? 1 : 1 - Math.exp(-dt / 112);
      this.fork += (target - this.fork) * amount;
    }
    const zoomTarget = zoomed ? 1.63 : 1;
    const widthScale = width / FORK_WIDTH;
    const scale = Math.min(widthScale, height / FORK_HEIGHT);
    this.zoom += (zoomTarget - this.zoom) * (this.reducedMotion ? 1 : 1 - Math.exp(-Math.max(dt, 16) / 125));
    const centerX = clamp(siteX(active), 275, 818);
    const centerY = 152;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate((width - FORK_WIDTH * scale) / 2, (height - FORK_HEIGHT * scale) / 2);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const glow = ctx.createRadialGradient(640, 220, 15, 640, 220, 525);
    glow.addColorStop(0, "#1e53626b");
    glow.addColorStop(.68, "#12333b27");
    glow.addColorStop(1, "#0b212900");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, FORK_WIDTH, FORK_HEIGHT);
    ctx.translate(centerX * (1 - this.zoom), centerY * (1 - this.zoom) + (this.zoom - 1) * 39);
    ctx.scale(this.zoom, this.zoom);

    this.paintUnopened();
    this.paintDaughters(round, round.time);
    this.paintMachinery(round);
    this.paintTemplateBases(round, round.time);
    this.paintAttempt(round, round.time);
    this.annotations(round);
  }
}
