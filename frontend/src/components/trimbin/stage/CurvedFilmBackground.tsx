import React, { useMemo } from 'react';

interface CurvedFilmConfig {
  segments: [[number, number], [number, number], [number, number], [number, number]][];
  sprocketStep?: number;
  frameStep?: number;
  gradientId?: string;
  opacity?: number;
}

function generateCurvedFilmData(config: CurvedFilmConfig) {
  const stepsPerSeg = 50;
  const samples: { x: number; y: number; nx: number; ny: number; angle: number; dist: number }[] = [];
  let totalDist = 0;

  for (let sIdx = 0; sIdx < config.segments.length; sIdx++) {
    const [p0, p1, p2, p3] = config.segments[sIdx];
    const startStep = sIdx === 0 ? 0 : 1;
    for (let i = startStep; i <= stepsPerSeg; i++) {
      const t = i / stepsPerSeg;
      const mt = 1 - t;
      const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0];
      const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1];

      const dx = 3 * mt * mt * (p1[0] - p0[0]) + 6 * mt * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
      const dy = 3 * mt * mt * (p1[1] - p0[1]) + 6 * mt * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);

      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      if (samples.length > 0) {
        const prev = samples[samples.length - 1];
        totalDist += Math.hypot(x - prev.x, y - prev.y);
      }

      samples.push({ x, y, nx, ny, angle, dist: totalDist });
    }
  }

  const topEdge = samples.map((s) => `${(s.x - s.nx * 31).toFixed(1)},${(s.y - s.ny * 31).toFixed(1)}`);
  const botEdge = [...samples].reverse().map((s) => `${(s.x + s.nx * 31).toFixed(1)},${(s.y + s.ny * 31).toFixed(1)}`);
  const outerPolygonPath = `M ${topEdge.join(' L ')} L ${botEdge.join(' L ')} Z`;

  const innerTop = samples.map((s) => `${(s.x - s.nx * 21).toFixed(1)},${(s.y - s.ny * 21).toFixed(1)}`);
  const innerBot = [...samples].reverse().map((s) => `${(s.x + s.nx * 21).toFixed(1)},${(s.y + s.ny * 21).toFixed(1)}`);
  const innerPolygonPath = `M ${innerTop.join(' L ')} L ${innerBot.join(' L ')} Z`;

  const getSampleAtDist = (targetD: number) => {
    if (targetD <= 0) return samples[0];
    if (targetD >= totalDist) return samples[samples.length - 1];
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].dist >= targetD) {
        const prev = samples[i - 1];
        const next = samples[i];
        const segLen = next.dist - prev.dist || 1;
        const alpha = (targetD - prev.dist) / segLen;
        return {
          x: prev.x + (next.x - prev.x) * alpha,
          y: prev.y + (next.y - prev.y) * alpha,
          nx: prev.nx + (next.nx - prev.nx) * alpha,
          ny: prev.ny + (next.ny - prev.ny) * alpha,
          angle: prev.angle + (next.angle - prev.angle) * alpha,
        };
      }
    }
    return samples[samples.length - 1];
  };

  const sprocketStep = config.sprocketStep || 18;
  const sprockets: { topX: number; topY: number; botX: number; botY: number; angle: number }[] = [];
  for (let d = 12; d < totalDist - 12; d += sprocketStep) {
    const s = getSampleAtDist(d);
    sprockets.push({
      topX: s.x - s.nx * 26,
      topY: s.y - s.ny * 26,
      botX: s.x + s.nx * 26,
      botY: s.y + s.ny * 26,
      angle: s.angle,
    });
  }

  const frameStep = config.frameStep || 120;
  const frameLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let d = 30; d < totalDist - 30; d += frameStep) {
    const s = getSampleAtDist(d);
    frameLines.push({
      x1: s.x - s.nx * 21,
      y1: s.y - s.ny * 21,
      x2: s.x + s.nx * 21,
      y2: s.y + s.ny * 21,
    });
  }

  return {
    outerPolygonPath,
    innerPolygonPath,
    sprockets,
    frameLines,
    gradientId: config.gradientId || 'filmSolidGrad1',
    opacity: config.opacity ?? 1.0,
  };
}

export const CurvedFilmBackground: React.FC = React.memo(() => {
  const curvedFilmStrips = useMemo(() => {
    return [
      generateCurvedFilmData({
        segments: [
          [[-80, -20], [350, 120], [780, -40], [1180, 80]],
          [[1180, 80], [1420, 150], [1580, 30], [1680, -20]],
        ],
        gradientId: 'filmSolidGrad3',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[-80, 90], [240, -30], [520, 220], [850, 100]],
          [[850, 100], [1150, -10], [1420, 160], [1680, 80]],
        ],
        gradientId: 'filmSolidGrad1',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[600, -60], [880, 170], [1140, 30], [1400, 200]],
          [[1400, 200], [1540, 290], [1620, 390], [1680, 480]],
        ],
        gradientId: 'filmSolidGrad2',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[-80, 240], [220, 140], [420, 370], [680, 250]],
          [[680, 250], [900, 150], [1100, 310], [1320, 210]],
        ],
        gradientId: 'filmSolidGrad1',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[140, -60], [50, 220], [220, 460], [70, 720]],
          [[70, 720], [-20, 860], [40, 940], [120, 980]],
        ],
        gradientId: 'filmSolidGrad3',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[-80, 430], [180, 320], [360, 620], [680, 480]],
          [[680, 480], [920, 380], [1200, 610], [1680, 440]],
        ],
        gradientId: 'filmSolidGrad2',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[980, 270], [1220, 450], [1420, 310], [1560, 510]],
          [[1560, 510], [1620, 590], [1650, 690], [1680, 780]],
        ],
        gradientId: 'filmSolidGrad1',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[1680, 180], [1340, 350], [940, 230], [550, 470]],
          [[550, 470], [310, 610], [140, 770], [-80, 840]],
        ],
        gradientId: 'filmSolidGrad3',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[1480, -60], [1580, 220], [1380, 480], [1520, 740]],
          [[1520, 740], [1580, 840], [1520, 920], [1460, 980]],
        ],
        gradientId: 'filmSolidGrad2',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[-80, 620], [320, 780], [720, 530], [1080, 710]],
          [[1080, 710], [1350, 840], [1550, 670], [1680, 590]],
        ],
        gradientId: 'filmSolidGrad1',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[-80, 780], [240, 580], [500, 880], [840, 720]],
          [[840, 720], [1140, 580], [1400, 840], [1680, 700]],
        ],
        gradientId: 'filmSolidGrad2',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[350, 980], [620, 730], [940, 920], [1260, 760]],
          [[1260, 760], [1440, 670], [1580, 810], [1680, 900]],
        ],
        gradientId: 'filmSolidGrad1',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[-80, 940], [380, 820], [800, 960], [1200, 860]],
          [[1200, 860], [1440, 800], [1580, 880], [1680, 940]],
        ],
        gradientId: 'filmSolidGrad3',
        opacity: 1.0,
      }),
      generateCurvedFilmData({
        segments: [
          [[-80, 320], [400, 160], [800, 480], [1250, 300]],
          [[1250, 300], [1450, 220], [1580, 300], [1680, 380]],
        ],
        gradientId: 'filmSolidGrad2',
        opacity: 1.0,
      }),
    ];
  }, []);

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-45 filter brightness-95 saturate-95"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="filmDropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#000000" floodOpacity="0.98" />
        </filter>
        <linearGradient id="filmSolidGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9a430c" />
          <stop offset="45%" stopColor="#632604" />
          <stop offset="100%" stopColor="#2c0f01" />
        </linearGradient>
        <linearGradient id="filmSolidGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#aa4c0e" />
          <stop offset="50%" stopColor="#702c06" />
          <stop offset="100%" stopColor="#361302" />
        </linearGradient>
        <linearGradient id="filmSolidGrad3" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8c3909" />
          <stop offset="50%" stopColor="#572003" />
          <stop offset="100%" stopColor="#240b01" />
        </linearGradient>
        <linearGradient id="filmEmulsionSolid" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#542004" />
          <stop offset="50%" stopColor="#311002" />
          <stop offset="100%" stopColor="#140500" />
        </linearGradient>
      </defs>

      {curvedFilmStrips.map((film, idx) => (
        <g key={`curved-film-${idx}`} filter="url(#filmDropShadow)" opacity={film.opacity}>
          <path d={film.outerPolygonPath} fill={`url(#${film.gradientId})`} />
          <path d={film.innerPolygonPath} fill="url(#filmEmulsionSolid)" />
          {film.frameLines.map((fl, flIdx) => (
            <line
              key={`fl-${idx}-${flIdx}`}
              x1={fl.x1}
              y1={fl.y1}
              x2={fl.x2}
              y2={fl.y2}
              stroke="#000000"
              strokeWidth="2.5"
            />
          ))}
          {film.sprockets.map((sp, spIdx) => (
            <React.Fragment key={`sp-${idx}-${spIdx}`}>
              <rect
                x={-4.5}
                y={-2.8}
                width={9}
                height={5.6}
                rx={1.2}
                transform={`translate(${sp.topX.toFixed(1)}, ${sp.topY.toFixed(1)}) rotate(${sp.angle.toFixed(1)})`}
                fill="#000000"
              />
              <rect
                x={-4.5}
                y={-2.8}
                width={9}
                height={5.6}
                rx={1.2}
                transform={`translate(${sp.botX.toFixed(1)}, ${sp.botY.toFixed(1)}) rotate(${sp.angle.toFixed(1)})`}
                fill="#000000"
              />
            </React.Fragment>
          ))}
        </g>
      ))}
    </svg>
  );
});
