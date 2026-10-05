const MAP_WIDTH = 230;
const MAP_HEIGHT = 170;
const PADDING = 18;

const TRACK_SAMPLES = 300;
const AHEAD_SAMPLES = 50;
const AHEAD_DISTANCE = 0.14;

export class Minimap {
  constructor(road, players) {
    this.road = road;
    this.players = players;

    this.canvases = [
      this.createCanvas("52px"),
      this.createCanvas("calc(50% + 52px)")
    ];

    this.contexts = this.canvases.map((canvas) => canvas.getContext("2d"));

    this.trackPoints = [];
    this.visible = false;

    this.buildTrack();
    this.hide();
  }

  createCanvas(top) {
    const canvas = document.createElement("canvas");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = MAP_WIDTH * dpr;
    canvas.height = MAP_HEIGHT * dpr;

    canvas.style.position = "fixed";
    canvas.style.top = top;
    canvas.style.left = "18px";
    canvas.style.width = `${MAP_WIDTH}px`;
    canvas.style.height = `${MAP_HEIGHT}px`;
    canvas.style.zIndex = "20";
    canvas.style.pointerEvents = "none";
    canvas.style.borderRadius = "12px";

    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return canvas;
  }

  setRoad(road) {
    this.road = road;
    this.buildTrack();
  }

  wrapProgress(progress) {
    return ((progress % 1) + 1) % 1;
  }

  buildTrack() {
    this.trackPoints = [];

    for (let i = 0; i <= TRACK_SAMPLES; i++) {
      const t = i / TRACK_SAMPLES;
      const point = this.road.spline.getPointAt(t);

      this.trackPoints.push({
        t,
        x: point.x,
        z: point.z
      });
    }
  }

  buildView(player) {
    const progress = this.wrapProgress(player.progress);
    const frame = this.road.getRoadFrame(progress);

    let forwardX = frame.tangent.x;
    let forwardZ = frame.tangent.z;

    const forwardLength = Math.hypot(forwardX, forwardZ) || 1;

    forwardX /= forwardLength;
    forwardZ /= forwardLength;

    // IMPORTANT:
    // -frame.right matches the player's visual screen-right direction.
    let rightX = -frame.right.x;
    let rightZ = -frame.right.z;

    const rightLength = Math.hypot(rightX, rightZ) || 1;

    rightX /= rightLength;
    rightZ /= rightLength;

    let minSide = Infinity;
    let maxSide = -Infinity;
    let minForward = Infinity;
    let maxForward = -Infinity;

    for (const point of this.trackPoints) {
      const dx = point.x - frame.center.x;
      const dz = point.z - frame.center.z;

      const side = dx * rightX + dz * rightZ;
      const forward = dx * forwardX + dz * forwardZ;

      minSide = Math.min(minSide, side);
      maxSide = Math.max(maxSide, side);
      minForward = Math.min(minForward, forward);
      maxForward = Math.max(maxForward, forward);
    }

    const worldWidth = Math.max(maxSide - minSide, 1);
    const worldHeight = Math.max(maxForward - minForward, 1);

    const availableWidth = MAP_WIDTH - PADDING * 2;
    const availableHeight = MAP_HEIGHT - PADDING * 2;

    const scale = Math.min(
      availableWidth / worldWidth,
      availableHeight / worldHeight
    );

    const drawnWidth = worldWidth * scale;
    const drawnHeight = worldHeight * scale;

    const leftPadding = (MAP_WIDTH - drawnWidth) / 2;
    const topPadding = (MAP_HEIGHT - drawnHeight) / 2;

    const offsetX = leftPadding - minSide * scale;
    const offsetY = topPadding + maxForward * scale;

    return {
      frame,
      forwardX,
      forwardZ,
      rightX,
      rightZ,
      scale,
      offsetX,
      offsetY
    };
  }

  worldToMap(x, z, view) {
    const dx = x - view.frame.center.x;
    const dz = z - view.frame.center.z;

    const side = dx * view.rightX + dz * view.rightZ;
    const forward = dx * view.forwardX + dz * view.forwardZ;

    return {
      x: view.offsetX + side * view.scale,
      y: view.offsetY - forward * view.scale
    };
  }

  drawBackground(ctx) {
    ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    ctx.fillStyle = "rgba(4, 6, 18, 0.80)";
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    ctx.strokeStyle = "rgba(120, 180, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, MAP_WIDTH - 1, MAP_HEIGHT - 1);
  }

  drawTrack(ctx, view) {
    if (!this.trackPoints.length) return;

    ctx.beginPath();

    this.trackPoints.forEach((point, index) => {
      const mapPoint = this.worldToMap(point.x, point.z, view);

      if (index === 0) {
        ctx.moveTo(mapPoint.x, mapPoint.y);
      } else {
        ctx.lineTo(mapPoint.x, mapPoint.y);
      }
    });

    ctx.closePath();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 9;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.strokeStyle = "rgba(90, 190, 255, 0.75)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  drawRoadAhead(ctx, player, view) {
    const progress = this.wrapProgress(player.progress);

    ctx.beginPath();

    for (let i = 0; i <= AHEAD_SAMPLES; i++) {
      const amount = i / AHEAD_SAMPLES;
      const t = this.wrapProgress(progress + AHEAD_DISTANCE * amount);

      const point = this.road.spline.getPointAt(t);
      const mapPoint = this.worldToMap(point.x, point.z, view);

      if (i === 0) {
        ctx.moveTo(mapPoint.x, mapPoint.y);
      } else {
        ctx.lineTo(mapPoint.x, mapPoint.y);
      }
    }

    ctx.strokeStyle = "rgba(80, 235, 255, 0.95)";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  drawStartLine(ctx, view) {
    const point = this.road.spline.getPointAt(0);
    const mapPoint = this.worldToMap(point.x, point.z, view);

    ctx.beginPath();
    ctx.arc(mapPoint.x, mapPoint.y, 3.5, 0, Math.PI * 2);

    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  getPlayerWorldPosition(player) {
    const progress = this.wrapProgress(player.progress);
    const frame = this.road.getRoadFrame(progress);

    return {
      x: frame.center.x + frame.right.x * player.lat,
      z: frame.center.z + frame.right.z * player.lat,
      frame
    };
  }

  drawPlayer(ctx, player, isCurrentPlayer, view) {
    const position = this.getPlayerWorldPosition(player);

    const mapPoint = this.worldToMap(
      position.x,
      position.z,
      view
    );

    let tangentX = position.frame.tangent.x;
    let tangentZ = position.frame.tangent.z;

    const tangentLength = Math.hypot(tangentX, tangentZ) || 1;

    tangentX /= tangentLength;
    tangentZ /= tangentLength;

    const directionSide =
      tangentX * view.rightX +
      tangentZ * view.rightZ;

    const directionForward =
      tangentX * view.forwardX +
      tangentZ * view.forwardZ;

    const screenDX = directionSide;
    const screenDY = -directionForward;

    const angle = Math.atan2(screenDY, screenDX) + Math.PI / 2;
    const size = isCurrentPlayer ? 9 : 6;

    ctx.save();

    ctx.translate(mapPoint.x, mapPoint.y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(-size * 0.65, size * 0.7);
    ctx.lineTo(size * 0.65, size * 0.7);
    ctx.closePath();

    ctx.fillStyle = player.color;
    ctx.fill();

    if (isCurrentPlayer) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.7;
      ctx.stroke();
    }

    ctx.restore();
  }

  draw(ctx, currentPlayerIndex) {
    const currentPlayer = this.players[currentPlayerIndex];
    const view = this.buildView(currentPlayer);

    this.drawBackground(ctx);
    this.drawTrack(ctx, view);
    this.drawRoadAhead(ctx, currentPlayer, view);
    this.drawStartLine(ctx, view);

    this.players.forEach((player, index) => {
      this.drawPlayer(
        ctx,
        player,
        index === currentPlayerIndex,
        view
      );
    });
  }

  update() {
    if (!this.visible) return;

    this.draw(this.contexts[0], 0);
    this.draw(this.contexts[1], 1);
  }

  show() {
    this.visible = true;

    this.canvases.forEach((canvas) => {
      canvas.style.display = "block";
    });

    this.update();
  }

  hide() {
    this.visible = false;

    this.canvases.forEach((canvas) => {
      canvas.style.display = "none";
    });
  }
}