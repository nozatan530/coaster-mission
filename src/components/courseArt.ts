/**
 * コース図（Canvas）の絵の部品
 * 実験室の背景・金属レール・スタンド・光ゲート・鉄球・アルミ缶などを描く。
 * 物理の計算はしない。座標はすべて画面のピクセル。
 */

type Ctx = CanvasRenderingContext2D;

export interface ScenePalette {
  dark: boolean;
}

// 背景：実験室の壁と木の床
export function drawLabScene(ctx: Ctx, width: number, height: number, floorY: number, p: ScenePalette) {
  // 壁
  const wall = ctx.createLinearGradient(0, 0, 0, floorY);
  if (p.dark) {
    wall.addColorStop(0, '#1B2742');
    wall.addColorStop(1, '#142036');
  } else {
    wall.addColorStop(0, '#F3F7FD');
    wall.addColorStop(1, '#E3EBF7');
  }
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, floorY);

  // 壁のパネルの継ぎ目
  ctx.strokeStyle = p.dark ? 'rgba(255,255,255,0.03)' : 'rgba(29,43,83,0.04)';
  ctx.lineWidth = 1;
  for (let x = 60; x < width; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, floorY - 8);
    ctx.stroke();
  }

  // 幅木
  ctx.fillStyle = p.dark ? '#26324D' : '#C9D4E6';
  ctx.fillRect(0, floorY - 8, width, 8);

  // 木の床
  const floor = ctx.createLinearGradient(0, floorY, 0, height);
  if (p.dark) {
    floor.addColorStop(0, '#4A3A2C');
    floor.addColorStop(1, '#2E241B');
  } else {
    floor.addColorStop(0, '#D9B48A');
    floor.addColorStop(1, '#B98E62');
  }
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, width, height - floorY);

  // 床板の継ぎ目
  ctx.strokeStyle = p.dark ? 'rgba(0,0,0,0.25)' : 'rgba(120,80,40,0.25)';
  ctx.lineWidth = 1;
  const rowH = Math.max(8, (height - floorY) / 3);
  for (let y = floorY + rowH; y < height; y += rowH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let row = 0; row * rowH < height - floorY; row++) {
    const offset = row % 2 === 0 ? 0 : 70;
    for (let x = offset + 40; x < width; x += 140) {
      ctx.beginPath();
      ctx.moveTo(x, floorY + row * rowH);
      ctx.lineTo(x, Math.min(height, floorY + (row + 1) * rowH));
      ctx.stroke();
    }
  }
  // 床の手前の縁の光
  ctx.fillStyle = p.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, floorY, width, 1.5);
}

// 左端のものさし（10 cm ごとの目盛り）
export function drawMeterStick(
  ctx: Ctx,
  x: number,
  toScreenY: (h: number) => number,
  maxH: number,
  p: ScenePalette
) {
  const top = toScreenY(maxH);
  const bottom = toScreenY(0);
  const w = 9;
  ctx.fillStyle = p.dark ? '#B58B2A' : '#F2C94C';
  ctx.strokeStyle = p.dark ? '#7A5C16' : '#B8901E';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, top, w, bottom - top, 1.5);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#3B2F12';
  ctx.fillStyle = p.dark ? '#E9DDBF' : '#4B3A10';
  ctx.font = '9px "M PLUS Rounded 1c", sans-serif';
  ctx.textAlign = 'right';
  for (let cm = 0; cm <= Math.floor(maxH * 100); cm += 10) {
    const y = toScreenY(cm / 100);
    const long = cm % 50 === 0;
    ctx.lineWidth = long ? 1.2 : 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (long ? w : w / 2), y);
    ctx.stroke();
    if (long) ctx.fillText(`${cm}`, x - 3, y + 3);
  }
  ctx.textAlign = 'center';
  ctx.fillText('cm', x + w / 2, top - 4);
}

// 金属レール（直線・円弧のパス）。build にパスを作る関数を渡す
export function strokeMetalRail(ctx: Ctx, build: () => void, p: ScenePalette) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 影
  ctx.save();
  ctx.translate(0, 3);
  ctx.strokeStyle = p.dark ? 'rgba(0,0,0,0.45)' : 'rgba(29,43,83,0.18)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  build();
  ctx.stroke();
  ctx.restore();
  // 本体
  ctx.strokeStyle = '#5B6474';
  ctx.lineWidth = 6;
  ctx.beginPath();
  build();
  ctx.stroke();
  ctx.strokeStyle = '#C7CED9';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  build();
  ctx.stroke();
  // 光沢
  ctx.save();
  ctx.translate(0, -1);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  build();
  ctx.stroke();
  ctx.restore();
}

// 実験用スタンド（金属の支柱・重い台座・クランプ）
export function drawMetalStand(ctx: Ctx, sx: number, syTop: number, floorY: number, baseW = 24) {
  const rod = ctx.createLinearGradient(sx - 2.5, 0, sx + 2.5, 0);
  rod.addColorStop(0, '#6B7280');
  rod.addColorStop(0.45, '#F3F4F6');
  rod.addColorStop(1, '#6B7280');
  ctx.fillStyle = rod;
  ctx.fillRect(sx - 2.5, syTop + 4, 5, floorY - syTop - 8);

  // 台座
  const base = ctx.createLinearGradient(0, floorY - 7, 0, floorY);
  base.addColorStop(0, '#4B5563');
  base.addColorStop(1, '#1F2937');
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.roundRect(sx - baseW / 2, floorY - 6, baseW, 6, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(sx, floorY + 2, baseW / 2 + 3, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // クランプ（つまみ付き）
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.roundRect(sx - 5, syTop + 2, 10, 7, 2);
  ctx.fill();
  ctx.fillStyle = '#9CA3AF';
  ctx.beginPath();
  ctx.arc(sx + 7, syTop + 5.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

// 光ゲート（速さを測る門）
export function drawPhotogate(ctx: Ctx, sx: number, railY: number, lit: boolean) {
  const h = 24;
  const w = 18;
  // コの字を逆さにした門（レールをまたぐ）
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 0.8;
  for (const [x, y, rw, rh] of [
    [sx - w / 2, railY - h, 4, h + 8],
    [sx + w / 2 - 4, railY - h, 4, h + 8],
    [sx - w / 2, railY - h - 4, w, 5],
  ]) {
    ctx.beginPath();
    ctx.roundRect(x, y, rw, rh, 1.5);
    ctx.fill();
    ctx.stroke();
  }
  // 光線
  ctx.strokeStyle = lit ? 'rgba(239,68,68,0.95)' : 'rgba(239,68,68,0.45)';
  ctx.lineWidth = lit ? 2.2 : 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(sx - w / 2 + 4, railY - 8);
  ctx.lineTo(sx + w / 2 - 4, railY - 8);
  ctx.stroke();
  ctx.setLineDash([]);
  // ランプ
  ctx.fillStyle = lit ? '#EF4444' : '#991B1B';
  ctx.beginPath();
  ctx.arc(sx, railY - h - 1.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (lit) {
    ctx.fillStyle = 'rgba(239,68,68,0.3)';
    ctx.beginPath();
    ctx.arc(sx, railY - h - 1.5, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 缶を吊るすスタンド・腕・電磁石
export function drawCanStand(ctx: Ctx, standX: number, armY: number, magX: number, floorY: number, magnetOn: boolean) {
  drawMetalStand(ctx, standX, armY - 4, floorY, 30);
  const arm = ctx.createLinearGradient(0, armY - 2, 0, armY + 2);
  arm.addColorStop(0, '#E5E7EB');
  arm.addColorStop(1, '#6B7280');
  ctx.fillStyle = arm;
  ctx.fillRect(Math.min(magX, standX), armY - 2, Math.abs(standX - magX) + 2, 4);
  // 電磁石（銅のコイル）
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.roundRect(magX - 7, armY + 1, 14, 10, 2);
  ctx.fill();
  ctx.strokeStyle = '#B87333';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(magX - 6, armY + 4 + i * 2.5);
    ctx.lineTo(magX + 6, armY + 4 + i * 2.5);
    ctx.stroke();
  }
  ctx.fillStyle = magnetOn ? '#22C55E' : '#6B7280';
  ctx.beginPath();
  ctx.arc(magX + 9, armY + 3, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

// アルミ缶（中心 cx, cy、回転 angle）
export function drawCan(ctx: Ctx, cx: number, cy: number, w: number, h: number, angle: number, label: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const body = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  body.addColorStop(0, '#8A94A6');
  body.addColorStop(0.3, '#F8FAFC');
  body.addColorStop(0.55, '#CBD5E1');
  body.addColorStop(1, '#64748B');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 2.5);
  ctx.fill();
  // ラベル帯
  const band = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  band.addColorStop(0, '#9F1D2B');
  band.addColorStop(0.3, '#F25C69');
  band.addColorStop(1, '#8A1622');
  ctx.fillStyle = band;
  ctx.fillRect(-w / 2, -h * 0.22, w, h * 0.46);
  // 上下のふち
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.ellipse(0, -h / 2 + 1, w / 2, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, 3);
  ctx.restore();
}

// 鉄球
export function drawSteelBall(ctx: Ctx, x: number, y: number, r: number) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.25, '#E2E8F0');
  g.addColorStop(0.65, '#7C8799');
  g.addColorStop(1, '#1E293B');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,23,42,0.6)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

// 床に落ちる影（高いほど薄く小さい）
export function drawFloorShadow(ctx: Ctx, x: number, floorY: number, heightPx: number, size: number) {
  const k = Math.max(0.15, 1 - heightPx / 260);
  ctx.fillStyle = `rgba(0,0,0,${0.28 * k})`;
  ctx.beginPath();
  ctx.ellipse(x, floorY + 3, size * (0.6 + 0.6 * k), 2.6 * k + 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 速さに応じた色（遅い=青 → 速い=赤）
export function speedColor(v: number, alpha: number) {
  const t = Math.max(0, Math.min(1, v / 3.5));
  const hue = 210 - 200 * t;
  return `hsla(${hue}, 85%, 55%, ${alpha})`;
}

// 浮かび上がる点数などの文字
export function drawPopup(ctx: Ctx, x: number, y: number, text: string, progress: number, color: string) {
  if (progress < 0 || progress > 1) return;
  const alpha = progress < 0.15 ? progress / 0.15 : 1 - Math.max(0, progress - 0.6) / 0.4;
  const rise = 26 * progress;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.font = 'bold 15px "M PLUS Rounded 1c", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(text, x, y - rise);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y - rise);
  ctx.restore();
}

// 命中の火花
export function drawSparks(ctx: Ctx, x: number, y: number, progress: number) {
  if (progress < 0 || progress > 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.3;
    const r1 = 6 + 26 * progress;
    const r2 = r1 + 7 * (1 - progress);
    ctx.strokeStyle = i % 2 === 0 ? '#FFC93C' : '#FF8A3D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + r1 * Math.cos(a), y + r1 * Math.sin(a));
    ctx.lineTo(x + r2 * Math.cos(a), y + r2 * Math.sin(a));
    ctx.stroke();
  }
  ctx.restore();
}
