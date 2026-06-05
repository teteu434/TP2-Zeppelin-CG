// ============================================================
// src/entities/aircraft.js — Nave (UFO)
//
// Hierarquia de partes:
//   [1] Hull  — disco principal (corpo/chassi)
//   [2] DomeLow + DomeTop — cúpula de vidro (cabine c/ visão)
//   [3] RotorBand — lateral/anel estrutural com rotação contínua
//   [4] Nacelles (×4) — motores em cruz
//   [5] Fins (×4) — aletas decorativas
//   [6] LightRing — anel de luz ventral emissivo (estático)
// ============================================================

const Aircraft = (() => {

  // ── Buffers de geometria ──────────────────────────────────
  let _hullBuf       = null;   // [1] disco principal
  let _domeLowBuf    = null;   // [2a] cúpula base (larga e baixa)
  let _domeTopBuf    = null;   // [2b] cúpula topo (estreita e alta)
  let _rotorBandBuf  = null;   // [3] lateral rotativa
  let _nacelleBuf    = null;   // [4] motor (elipsoide achatado)
  let _ringBuf       = null;   // [6] anel de luz ventral
  let _finBuf        = null;   // [5] aleta decorativa

  // ── Materiais ─────────────────────────────────────────────
  let _matHull       = null;
  let _matDomeLow    = null;
  let _matDomeTop    = null;
  let _matRotorBand  = null;   // lateral rotativa
  let _matNacelle    = null;
  let _matRing       = null;
  let _matFin        = null;

  // Nota: o ângulo do rotor lateral é lido de State.get().aircraft.rotorAngle.
  // O MovementSystem já acumula esse valor a cada frame (ac.rotorAngle += ...).

  // ─────────────────────────────────────────────────────────
  // [1] Disco principal (hull)
  // Perfil de lente biconvexa com borda biselada.
  // ─────────────────────────────────────────────────────────
  function _buildHull(gl) {
    const segs   = 48;
    const outerR = 5.0;
    const midR   = 4.2;
    const innerR = 1.2;
    const yBot   = -0.5;
    const yMid   = 0.0;
    const yBevel = 0.35;
    const yTop   = 0.55;

    const positions = [], normals = [], texcoords = [];

    function quad(p0, p1, p2, p3, nx, ny, nz) {
      const n = [nx, ny, nz];
      positions.push(...p0,...p1,...p2,...p0,...p2,...p3);
      for (let i = 0; i < 6; i++) normals.push(...n);
      texcoords.push(0,0,1,0,1,1,0,0,1,1,0,1);
    }

    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);

      // Face inferior (-Y)
      quad(
        [c1*innerR, yBot, s1*innerR],
        [c0*innerR, yBot, s0*innerR],
        [c0*outerR, yBot, s0*outerR],
        [c1*outerR, yBot, s1*outerR],
        0,-1,0
      );

      // Lateral exterior vertical
      const le0 = [c0*outerR, yBot, s0*outerR];
      const le1 = [c1*outerR, yBot, s1*outerR];
      const lm0 = [c0*outerR, yMid, s0*outerR];
      const lm1 = [c1*outerR, yMid, s1*outerR];
      positions.push(...le0,...lm0,...lm1,...le0,...lm1,...le1);
      const ne0 = [c0, 0, s0], ne1 = [c1, 0, s1];
      normals.push(...ne0,...ne0,...ne1,...ne0,...ne1,...ne1);
      texcoords.push(0,0,0,1,1,1,0,0,1,1,1,0);

      // Bisel superior (outerR→midR, yMid→yBevel)
      const bv0b = [c0*outerR, yMid,   s0*outerR];
      const bv1b = [c1*outerR, yMid,   s1*outerR];
      const bv0t = [c0*midR,   yBevel, s0*midR];
      const bv1t = [c1*midR,   yBevel, s1*midR];
      const bvnx = (c0+c1)*0.5 * 0.7, bvnz = (s0+s1)*0.5 * 0.7;
      positions.push(...bv0b,...bv0t,...bv1t,...bv0b,...bv1t,...bv1b);
      const bvn = [bvnx, 0.7, bvnz];
      for (let k = 0; k < 6; k++) normals.push(...bvn);
      texcoords.push(0,0,0,1,1,1,0,0,1,1,1,0);

      // Degrau vertical na borda midR (yBevel→yTop)
      quad(
        [c0*midR, yTop,   s0*midR],
        [c1*midR, yTop,   s1*midR],
        [c1*midR, yBevel, s1*midR],
        [c0*midR, yBevel, s0*midR],
        (c0+c1)*0.5, 0, (s0+s1)*0.5
      );

      // Topo plano (midR→innerR, y=yTop)
      quad(
        [c1*innerR, yTop, s1*innerR],
        [c1*midR,   yTop, s1*midR],
        [c0*midR,   yTop, s0*midR],
        [c0*innerR, yTop, s0*innerR],
        0,1,0
      );
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals)   },
      a_texcoord: { numComponents:2, data: new Float32Array(texcoords) },
    });
  }

  // ─────────────────────────────────────────────────────────
  // [3] RotorBand lateral — rotação contínua em Y
  //
  // O rotor fica embutido na lateral do casco e é assimétrico
  // para que a rotação seja perceptível de longe.
  // ─────────────────────────────────────────────────────────
  function _buildRotorBand(gl) {
    const majorR   = 5.25;   // cerca do outerR=5.0 do hull
    const minorR   = 0.28;   // espessura da banda
    const majorSeg = 64;
    const minorSeg = 12;
    const yCenter  = 0.0;

    const positions = [], normals = [], texcoords = [];

    function torusPoint(u, v) {
      const cu = Math.cos(u), su = Math.sin(u);
      const cv = Math.cos(v), sv = Math.sin(v);
      const r  = majorR + minorR * cv;
      return [r * cu, yCenter + minorR * sv, r * su];
    }

    function torusNormal(u, v) {
      const cu = Math.cos(u), su = Math.sin(u);
      const cv = Math.cos(v), sv = Math.sin(v);
      return [cv * cu, sv, cv * su];
    }

    function pushTri(p0, p1, p2, n0, n1, n2, uv0, uv1, uv2) {
      positions.push(...p0, ...p1, ...p2);
      normals.push(...n0, ...n1, ...n2);
      texcoords.push(...uv0, ...uv1, ...uv2);
    }

    function rotateYPoint(p, angle) {
      const c = Math.cos(angle), s = Math.sin(angle);
      return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
    }

    function rotateYNormal(n, angle) {
      const c = Math.cos(angle), s = Math.sin(angle);
      return [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c];
    }

    function pushBox(center, angle, size) {
      const [cx, cy, cz] = center;
      const [sx, sy, sz] = size;
      const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;

      const v = {
        ldb: [-hx, -hy, -hz],
        rdb: [ hx, -hy, -hz],
        rtb: [ hx,  hy, -hz],
        ltb: [-hx,  hy, -hz],
        ldf: [-hx, -hy,  hz],
        rdf: [ hx, -hy,  hz],
        rtf: [ hx,  hy,  hz],
        ltf: [-hx,  hy,  hz],
      };

      for (const key of Object.keys(v)) {
        const p = rotateYPoint(v[key], angle);
        v[key] = [p[0] + cx, p[1] + cy, p[2] + cz];
      }

      const faces = [
        [v.ldb, v.rdb, v.rtb, v.ltb, [0, 0, -1]],
        [v.rdf, v.ldf, v.ltf, v.rtf, [0, 0,  1]],
        [v.ldf, v.ldb, v.ltb, v.ltf, [-1, 0, 0]],
        [v.rdb, v.rdf, v.rtf, v.rtb, [ 1, 0, 0]],
        [v.ltb, v.rtb, v.rtf, v.ltf, [0, 1, 0]],
        [v.ldf, v.rdf, v.rdb, v.ldb, [0,-1, 0]],
      ];

      for (const [p0, p1, p2, p3, n] of faces) {
        const nn = rotateYNormal(n, angle);
        pushTri(p0, p1, p2, nn, nn, nn, [0,0], [1,0], [1,1]);
        pushTri(p0, p2, p3, nn, nn, nn, [0,0], [1,1], [0,1]);
      }
    }

    for (let i = 0; i < majorSeg; i++) {
      const u0 = (i     / majorSeg) * Math.PI * 2;
      const u1 = ((i+1) / majorSeg) * Math.PI * 2;

      for (let j = 0; j < minorSeg; j++) {
        const v0 = (j     / minorSeg) * Math.PI * 2;
        const v1 = ((j+1) / minorSeg) * Math.PI * 2;

        const p = [
          [u0, v0], [u1, v0], [u1, v1], [u0, v1],
        ].map(([u, v]) => torusPoint(u, v));
        const n = [
          [u0, v0], [u1, v0], [u1, v1], [u0, v1],
        ].map(([u, v]) => torusNormal(u, v));

        for (const [a, b, c] of [[0,1,2], [0,2,3]]) {
          positions.push(...p[a], ...p[b], ...p[c]);
          normals.push(...n[a], ...n[b], ...n[c]);
          texcoords.push(
            i / majorSeg,       j / minorSeg,
            (i+1) / majorSeg,   j / minorSeg,
            (i+1) / majorSeg,  (j+1) / minorSeg
          );
        }
      }
    }

    // 8 aletas curtas para quebrar a simetria e deixar a rotação visível.
    const bladeCount = 8;
    const bladeRadius = majorR + minorR * 0.95;
    for (let i = 0; i < bladeCount; i++) {
      const a = (i / bladeCount) * Math.PI * 2 + Math.PI / bladeCount;
      const center = [Math.cos(a) * bladeRadius, 0.0, Math.sin(a) * bladeRadius];
      pushBox(center, a + Math.PI / 2, [0.22, 0.95, 0.08]);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals)   },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  // ─────────────────────────────────────────────────────────
  // [6] Anel de luz ventral (emissivo, estático)
  // ─────────────────────────────────────────────────────────
  function _buildRing(gl) {
    const segs = 48;
    const yBot = -0.52;
    const positions = [], normals = [], texcoords = [];

    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);

      const rl0 = [c0*2.8, yBot, s0*2.8];
      const rl1 = [c1*2.8, yBot, s1*2.8];
      const ro0 = [c0*3.4, yBot, s0*3.4];
      const ro1 = [c1*3.4, yBot, s1*3.4];

      positions.push(...rl1,...rl0,...ro0,...rl1,...ro0,...ro1);
      for (let k = 0; k < 6; k++) normals.push(0,-1,0);
      texcoords.push(0,0,1,0,1,1,0,0,1,1,0,1);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals)   },
      a_texcoord: { numComponents:2, data: new Float32Array(texcoords) },
    });
  }

  // ─────────────────────────────────────────────────────────
  // [2a] Cúpula inferior (cabine — larga e achatada)
  // ─────────────────────────────────────────────────────────
  function _buildDomeLow(gl) {
    const stacks = 6, slices = 36;
    const rx = 1.2, ry = 0.5, rz = 1.2;
    const positions = [], normals = [], texcoords = [];

    for (let st = 0; st < stacks; st++) {
      const phi0 = (st     / stacks) * Math.PI * 0.5;
      const phi1 = ((st+1) / stacks) * Math.PI * 0.5;

      for (let sl = 0; sl < slices; sl++) {
        const th0 = (sl     / slices) * Math.PI * 2;
        const th1 = ((sl+1) / slices) * Math.PI * 2;

        const pts = [[phi0,th0],[phi1,th0],[phi1,th1],[phi0,th1]].map(([ph,th]) => [
          Math.sin(ph)*Math.cos(th)*rx,
          Math.cos(ph)*ry,
          Math.sin(ph)*Math.sin(th)*rz,
        ]);
        const nrm = pts.map(p => [p[0]/(rx*rx), p[1]/(ry*ry), p[2]/(rz*rz)]);

        for (const [a,b,c] of [[0,2,1],[0,3,2]]) {
          for (const idx of [a,b,c]) {
            positions.push(...pts[idx]);
            normals.push(...nrm[idx]);
            texcoords.push(sl/slices, st/stacks);
          }
        }
      }
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals)   },
      a_texcoord: { numComponents:2, data: new Float32Array(texcoords) },
    });
  }

  // ─────────────────────────────────────────────────────────
  // [2b] Cúpula superior (cabine — esfera alta e estreita)
  // ─────────────────────────────────────────────────────────
  function _buildDomeTop(gl) {
    const stacks = 10, slices = 32;
    const radius = 1.0;
    const positions = [], normals = [], texcoords = [];

    for (let st = 0; st < stacks; st++) {
      const phi0 = (st     / stacks) * Math.PI * 0.55;
      const phi1 = ((st+1) / stacks) * Math.PI * 0.55;

      for (let sl = 0; sl < slices; sl++) {
        const th0 = (sl     / slices) * Math.PI * 2;
        const th1 = ((sl+1) / slices) * Math.PI * 2;

        const pts = [[phi0,th0],[phi1,th0],[phi1,th1],[phi0,th1]].map(([ph,th]) => [
          Math.sin(ph)*Math.cos(th)*radius,
          Math.cos(ph)*radius,
          Math.sin(ph)*Math.sin(th)*radius,
        ]);
        const nrm = pts.map(p => [p[0]/radius, p[1]/radius, p[2]/radius]);

        for (const [a,b,c] of [[0,2,1],[0,3,2]]) {
          for (const idx of [a,b,c]) {
            positions.push(...pts[idx]);
            normals.push(...nrm[idx]);
            texcoords.push(sl/slices, st/stacks);
          }
        }
      }
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals)   },
      a_texcoord: { numComponents:2, data: new Float32Array(texcoords) },
    });
  }

  // ─────────────────────────────────────────────────────────
  // [4] Nacele (motor) — elipsoide achatado horizontal
  // ─────────────────────────────────────────────────────────
  function _buildNacelle(gl) {
    const stacks = 8, slices = 20;
    const rx = 0.9, ry = 0.28, rz = 0.4;
    const positions = [], normals = [], texcoords = [];

    for (let st = 0; st < stacks; st++) {
      const phi0 = (st     / stacks) * Math.PI;
      const phi1 = ((st+1) / stacks) * Math.PI;

      for (let sl = 0; sl < slices; sl++) {
        const th0 = (sl     / slices) * Math.PI * 2;
        const th1 = ((sl+1) / slices) * Math.PI * 2;

        const pts = [[phi0,th0],[phi1,th0],[phi1,th1],[phi0,th1]].map(([ph,th]) => [
          Math.sin(ph)*Math.cos(th)*rx,
          Math.cos(ph)*ry,
          Math.sin(ph)*Math.sin(th)*rz,
        ]);
        const nrm = pts.map(p => [p[0]/(rx*rx), p[1]/(ry*ry), p[2]/(rz*rz)]);

        for (const [a,b,c] of [[0,2,1],[0,3,2]]) {
          for (const idx of [a,b,c]) {
            positions.push(...pts[idx]);
            normals.push(...nrm[idx]);
            texcoords.push(sl/slices, st/stacks);
          }
        }
      }
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals)   },
      a_texcoord: { numComponents:2, data: new Float32Array(texcoords) },
    });
  }

  // ─────────────────────────────────────────────────────────
  // [5] Aleta decorativa — plano vertical triangular
  // ─────────────────────────────────────────────────────────
  function _buildFin(gl) {
    const h = 0.55, l = 0.6, thick = 0.06;
    const positions = [
      -l,0, thick,  l,0, thick,  0,h, thick,
       l,0,-thick, -l,0,-thick,  0,h,-thick,
      -l,0, thick,  0,h, thick,  0,h,-thick,
      -l,0, thick,  0,h,-thick, -l,0,-thick,
       l,0,-thick,  0,h,-thick,  0,h, thick,
       l,0,-thick,  0,h, thick,  l,0, thick,
    ];
    const normals = [
      0,0,1,0,0,1,0,0,1,
      0,0,-1,0,0,-1,0,0,-1,
      -0.7,0.7,0,-0.7,0.7,0,-0.7,0.7,0,
      -0.7,0.7,0,-0.7,0.7,0,-0.7,0.7,0,
       0.7,0.7,0, 0.7,0.7,0, 0.7,0.7,0,
       0.7,0.7,0, 0.7,0.7,0, 0.7,0.7,0,
    ];
    const tc = new Array(positions.length / 3 * 2).fill(0);

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals)   },
      a_texcoord: { numComponents:2, data: new Float32Array(tc)        },
    });
  }

  // ─────────────────────────────────────────────────────────
  // init — cria buffers e materiais
  // ─────────────────────────────────────────────────────────
  function init(gl, textures) {
    _hullBuf       = _buildHull(gl);
    _rotorBandBuf  = _buildRotorBand(gl);
    _ringBuf       = _buildRing(gl);
    _domeLowBuf    = _buildDomeLow(gl);
    _domeTopBuf    = _buildDomeTop(gl);
    _nacelleBuf    = _buildNacelle(gl);
    _finBuf        = _buildFin(gl);

    // [1] Metal escovado — casco
    _matHull = {
      diffuse:    [0.72, 0.74, 0.78],
      ambient:    [0.20, 0.20, 0.22],
      specular:   [0.95, 0.95, 0.90],
      shininess:  90,
      alpha:      1.0,
      texture:    textures.metal,
      useTexture: true,
    };

    // [2a] Vidro esverdeado translúcido — cúpula baixa (cabine)
    _matDomeLow = {
      diffuse:    [0.30, 0.65, 0.40],
      ambient:    [0.10, 0.25, 0.15],
      specular:   [0.90, 1.00, 0.90],
      shininess:  140,
      alpha:      0.85,
      useTexture: false,
    };

    // [2b] Vidro azul translúcido — cúpula superior (cabine)
    _matDomeTop = {
      diffuse:    [0.20, 0.50, 0.70],
      ambient:    [0.08, 0.18, 0.28],
      specular:   [1.00, 1.00, 1.00],
      shininess:  180,
      alpha:      0.85,
      useTexture: false,
    };

    // [3] Rotor lateral — metal frio e escuro
    _matRotorBand = {
      diffuse:    [0.40, 0.43, 0.48],
      ambient:    [0.12, 0.13, 0.15],
      specular:   [0.95, 0.95, 1.00],
      shininess:  110,
      alpha:      1.0,
      useTexture: false,
    };

    // [4] Metal escuro — naceles
    _matNacelle = {
      diffuse:    [0.25, 0.26, 0.30],
      ambient:    [0.08, 0.08, 0.10],
      specular:   [0.80, 0.80, 0.75],
      shininess:  60,
      alpha:      1.0,
      useTexture: false,
    };

    // [6] Luz de pouso emissiva — anel ventral
    _matRing = {
      diffuse:    [0.80, 1.00, 0.40],
      ambient:    [0.80, 1.00, 0.40],
      specular:   [1.00, 1.00, 0.80],
      shininess:  10,
      alpha:      0.90,
      useTexture: false,
    };

    // [5] Metal médio — aletas
    _matFin = {
      diffuse:    [0.50, 0.52, 0.56],
      ambient:    [0.15, 0.15, 0.17],
      specular:   [0.70, 0.70, 0.65],
      shininess:  45,
      alpha:      1.0,
      useTexture: false,
    };
  }

  // ─────────────────────────────────────────────────────────
  // update(dt) — a animação temporal principal é feita pelo
  // MovementSystem, que atualiza rotorAngle, hoverOffset e wobble.
  // ─────────────────────────────────────────────────────────
  function update(dt) {
    // Mantido por compatibilidade com o game loop.
  }

  // ─────────────────────────────────────────────────────────
  // getRenderObjects — retorna a lista de { bufferInfo, material, modelMat }
  //
  // Hierarquia:
  //   root  (posição + orientação da nave, lida de State)
  //   ├─ hull          (escala 1:1 relativa à root)
  //   ├─ lightRing     (ventral, estático relativo à root)
  //   ├─ domeLow       (translate +Y a partir da root)
  //   ├─ domeTop       (translate +Y a partir da root)
  //   ├─ rotorBand     (peça lateral com rotateY contínuo relativo à root)
  //   ├─ nacelle[0..3] (translate radial + rotateY relativo à root)
  //   └─ fin[0..3]     (translate diagonal + rotateY relativo à root)
  // ─────────────────────────────────────────────────────────
  function getRenderObjects() {
    const ac   = State.get().aircraft;
    const m4   = twgl.m4;
    const objs = [];

    // ── Nó raiz: posição + orientação da nave ────────────
    let root = m4.identity();
    root = m4.translate(root, ac.position);
    root = m4.translate(root, [0, ac.hoverOffset || 0, 0]);
    root = m4.rotateY(root,   ac.rotation);
    root = m4.rotateX(root,   ac.tiltX + (ac.wobbleX || 0));
    root = m4.rotateZ(root,   ac.tiltZ + (ac.wobbleZ || 0));

    // ── [1] Casco principal ───────────────────────────────
    objs.push({
      bufferInfo: _hullBuf,
      material:   _matHull,
      modelMat:   m4.copy(root),
    });

    // ── [6] Anel de luz ventral (estático) ────────────────
    objs.push({
      bufferInfo: _ringBuf,
      material:   _matRing,
      modelMat:   m4.copy(root),
    });

    // ── [2a] Cúpula inferior (cabine) ─────────────────────
    // yTop do hull = 0.55 → base da cúpula começa aqui
    objs.push({
      bufferInfo: _domeLowBuf,
      material:   _matDomeLow,
      modelMat:   m4.translate(root, [0, 0.55, 0]),
    });

    // ── [2b] Cúpula superior (cabine) ─────────────────────
    // ry da dome low = 0.5 → sobe mais 0.48 para encaixar
    objs.push({
      bufferInfo: _domeTopBuf,
      material:   _matDomeTop,
      modelMat:   m4.translate(root, [0, 0.55 + 0.48, 0]),
    });

    // ── [3] Rotor lateral — rotação contínua em Y ──────────
    // A banda lateral gira como uma peça estrutural integrada
    // ao casco e tem pequenos ressaltos para deixar a rotação visível.
    {
      const rotorMat = m4.rotateY(m4.copy(root), ac.rotorAngle);
      objs.push({
        bufferInfo: _rotorBandBuf,
        material:   _matRotorBand,
        modelMat:   rotorMat,
      });
    }

    // ── [4] 4 Naceles (motores) em cruz ───────────────────
    const nacelleOffsets   = [
      [ 3.8, -0.05,  0.0],
      [-3.8, -0.05,  0.0],
      [ 0.0, -0.05,  3.8],
      [ 0.0, -0.05, -3.8],
    ];
    const nacelleRotations = [0, 0, Math.PI/2, Math.PI/2];

    for (let i = 0; i < 4; i++) {
      let nm = m4.translate(root, nacelleOffsets[i]);
      nm = m4.rotateY(nm, nacelleRotations[i]);
      objs.push({ bufferInfo: _nacelleBuf, material: _matNacelle, modelMat: nm });
    }

    // ── [5] 4 Aletas decorativas (a 45°) ─────────────────
    const finAngles = [Math.PI/4, -Math.PI/4, 3*Math.PI/4, -3*Math.PI/4];
    for (const angle of finAngles) {
      let fm = m4.translate(root, [
        Math.sin(angle) * 4.0,
        0.38,
        Math.cos(angle) * 4.0,
      ]);
      fm = m4.rotateY(fm, angle);
      objs.push({ bufferInfo: _finBuf, material: _matFin, modelMat: fm });
    }

    return objs;
  }

  // API pública
  return { init, update, getRenderObjects };

})();