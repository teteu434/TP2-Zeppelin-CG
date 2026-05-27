// ============================================================
// src/entities/aircraft.js — Nave (UFO redesenhada)
// Geometria em camadas:
//   - Disco inferior achatado (hull)
//   - Anel de borda biselado
//   - Cúpula superior em dois estágios
//   - 4 naceles (motores) simétricos
//   - Anel de luz central (emissivo)
// ============================================================

const Aircraft = (() => {

  // Buffers de geometria
  let _hullBuf    = null;  // disco principal
  let _domeLowBuf = null;  // cúpula base (larga e baixa)
  let _domeTopBuf = null;  // cúpula topo (estreita e alta)
  let _nacelleBuf = null;  // motor (elipsoide achatado)
  let _ringBuf    = null;  // anel de luz ventral
  let _finBuf     = null;  // aleta decorativa

  // Materiais
  let _matHull    = null;
  let _matDomeLow = null;
  let _matDomeTop = null;
  let _matNacelle = null;
  let _matRing    = null;
  let _matFin     = null;

  // ── Disco principal (hull) ────────────────────────────────
  // Perfil de lente biconvexa: raio externo grande, altura pequena,
  // com borda biselada. Construído como dois anéis côncavos.
  function _buildHull(gl) {
    const segs    = 48;
    const outerR  = 5.0;
    const midR    = 4.2;   // onde começa o bisel da borda
    const innerR  = 1.2;   // buraco central (cúpula encaixa aqui)
    const yBot    = -0.5;  // fundo do disco
    const yMid    = 0.0;   // linha do equador
    const yBevel  = 0.35;  // topo do bisel da borda
    const yTop    = 0.55;  // topo plano do disco

    const positions = [], normals = [], texcoords = [];

    function quad(p0, p1, p2, p3, nx, ny, nz) {
      // CCW: p0,p1,p2 e p0,p2,p3
      const n = [nx, ny, nz];
      positions.push(...p0,...p1,...p2,...p0,...p2,...p3);
      for (let i = 0; i < 6; i++) normals.push(...n);
      texcoords.push(0,0,1,0,1,1,0,0,1,1,0,1);
    }

    function tri(p0, p1, p2, nx, ny, nz) {
      positions.push(...p0,...p1,...p2);
      const n = [nx, ny, nz];
      normals.push(...n,...n,...n);
      texcoords.push(0,0,1,0,0.5,1);
    }

    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);

      // ── Face inferior (normal -Y)
      // Do anel interno até a borda exterior (yBot)
      const bi0 = [c0*innerR, yBot, s0*innerR];
      const bi1 = [c1*innerR, yBot, s1*innerR];
      const bo0 = [c0*outerR, yBot, s0*outerR];
      const bo1 = [c1*outerR, yBot, s1*outerR];
      quad(bi1, bi0, bo0, bo1, 0,-1,0);

      // ── Lateral exterior (bisel inferior: yBot → yMid)
      const le0 = [c0*outerR, yBot, s0*outerR];
      const le1 = [c1*outerR, yBot, s1*outerR];
      const lm0 = [c0*outerR, yMid, s0*outerR];
      const lm1 = [c1*outerR, yMid, s1*outerR];
      const ne0 = [c0, 0, s0], ne1 = [c1, 0, s1];
      positions.push(...le0,...lm0,...lm1,...le0,...lm1,...le1);
      normals.push(...ne0,...ne0,...ne1,...ne0,...ne1,...ne1);
      texcoords.push(0,0,0,1,1,1,0,0,1,1,1,0);

      // ── Bisel superior (yMid → yBevel, afilando de outerR → midR)
      const bv0_bot = [c0*outerR, yMid,   s0*outerR];
      const bv1_bot = [c1*outerR, yMid,   s1*outerR];
      const bv0_top = [c0*midR,   yBevel, s0*midR];
      const bv1_top = [c1*midR,   yBevel, s1*midR];
      // Normal apontando para fora e para cima
      const bvnx = (c0+c1)*0.5 * 0.7, bvnz = (s0+s1)*0.5 * 0.7;
      positions.push(...bv0_bot,...bv0_top,...bv1_top,...bv0_bot,...bv1_top,...bv1_bot);
      const bvn = [bvnx, 0.7, bvnz];
      for (let k=0;k<6;k++) normals.push(...bvn);
      texcoords.push(0,0,0,1,1,1,0,0,1,1,1,0);

      // ── Topo plano do disco (yBevel → yTop, midR → innerR)
      const tp0_out = [c0*midR,   yTop, s0*midR];
      const tp1_out = [c1*midR,   yTop, s1*midR];
      const tp0_in  = [c0*innerR, yTop, s0*innerR];
      const tp1_in  = [c1*innerR, yTop, s1*innerR];
      // Degrau vertical (yBevel → yTop) na borda midR
      quad(
        [c0*midR, yTop,   s0*midR],
        [c1*midR, yTop,   s1*midR],
        [c1*midR, yBevel, s1*midR],
        [c0*midR, yBevel, s0*midR],
        (c0+c1)*0.5, 0, (s0+s1)*0.5
      );
      // Topo plano
      quad(tp1_in, tp1_out, tp0_out, tp0_in, 0, 1, 0);

      // ── Anel de luz ventral (anel fino em yBot-0.02, raio 2.8..3.4)
      const rl0 = [c0*2.8, yBot-0.02, s0*2.8];
      const rl1 = [c1*2.8, yBot-0.02, s1*2.8];
      const ro0 = [c0*3.4, yBot-0.02, s0*3.4];
      const ro1 = [c1*3.4, yBot-0.02, s1*3.4];
      // Guardamos para o _ringBuf separado — aqui só hull
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals) },
      a_texcoord: { numComponents:2, data: new Float32Array(texcoords) },
    });
  }

  // ── Anel de luz ventral (separado para material emissivo) ─
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
      for (let k=0;k<6;k++) normals.push(0,-1,0);
      texcoords.push(0,0,1,0,1,1,0,0,1,1,0,1);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals) },
      a_texcoord: { numComponents:2, data: new Float32Array(texcoords) },
    });
  }

  // ── Cúpula inferior (larga e achatada) ───────────────────
  function _buildDomeLow(gl) {
    const stacks = 6, slices = 36;
    const rx = 1.2, ry = 0.5, rz = 1.2; // elipsoide achatado
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
        const nrm = pts.map(p => [p[0]/rx/rx, p[1]/ry/ry, p[2]/rz/rz]);

        for (const tri of [[0,2,1],[0,3,2]]) {
          for (const idx of tri) {
            positions.push(...pts[idx]);
            normals.push(...nrm[idx]);
            texcoords.push(sl/slices, st/stacks);
          }
        }
      }
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals) },
      a_texcoord: { numComponents:2, data: new Float32Array(texcoords) },
    });
  }

  // ── Cúpula superior (esfera mais alta e estreita) ─────────
  function _buildDomeTop(gl) {
    const stacks = 10, slices = 32;
    const radius = 1.0;
    const positions = [], normals = [], texcoords = [];

    for (let st = 0; st < stacks; st++) {
      const phi0 = (st     / stacks) * Math.PI * 0.55; // não vai até o equador
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

        for (const tri of [[0,2,1],[0,3,2]]) {
          for (const idx of tri) {
            positions.push(...pts[idx]);
            normals.push(...nrm[idx]);
            texcoords.push(sl/slices, st/stacks);
          }
        }
      }
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals) },
      a_texcoord: { numComponents:2, data: new Float32Array(texcoords) },
    });
  }

  // ── Nacele (motor) — elipsoide achatado horizontal ────────
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
        const nrm = pts.map(p => [p[0]/rx/rx, p[1]/ry/ry, p[2]/rz/rz]);

        for (const tri of [[0,2,1],[0,3,2]]) {
          for (const idx of tri) {
            positions.push(...pts[idx]);
            normals.push(...nrm[idx]);
            texcoords.push(sl/slices, st/stacks);
          }
        }
      }
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals) },
      a_texcoord: { numComponents:2, data: new Float32Array(texcoords) },
    });
  }

  // ── Aleta decorativa (fin) — plano vertical fino ──────────
  function _buildFin(gl) {
    // Triângulo achatado, espessura mínima
    const h = 0.55, l = 0.6, thick = 0.06;
    const positions = [
      // Face Z+
      -l,0, thick,  l,0, thick,  0,h, thick,
      // Face Z-
       l,0,-thick, -l,0,-thick,  0,h,-thick,
      // Topo
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
    const tc = new Array(positions.length/3*2).fill(0);

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents:3, data: new Float32Array(positions) },
      a_normal:   { numComponents:3, data: new Float32Array(normals) },
      a_texcoord: { numComponents:2, data: new Float32Array(tc) },
    });
  }

  // ── Init ──────────────────────────────────────────────────
  function init(gl, textures) {
    _hullBuf    = _buildHull(gl);
    _ringBuf    = _buildRing(gl);
    _domeLowBuf = _buildDomeLow(gl);
    _domeTopBuf = _buildDomeTop(gl);
    _nacelleBuf = _buildNacelle(gl);
    _finBuf     = _buildFin(gl);

    // Metal escovado para o casco
    _matHull = {
      diffuse:    [0.72, 0.74, 0.78],
      ambient:    [0.20, 0.20, 0.22],
      specular:   [0.95, 0.95, 0.90],
      shininess:  90,
      alpha:      1.0,
      texture:    textures.metal,
      useTexture: true,
    };

    // Vidro esverdeado translúcido para a cúpula baixa
    _matDomeLow = {
      diffuse:   [0.30, 0.65, 0.40],
      ambient:   [0.10, 0.25, 0.15],
      specular:  [0.90, 1.00, 0.90],
      shininess: 140,
      alpha:     0.9,
      useTexture: false,
    };

    // Vidro azul-esverdeado para a cúpula superior
    _matDomeTop = {
      diffuse:   [0.20, 0.50, 0.70],
      ambient:   [0.08, 0.18, 0.28],
      specular:  [1.00, 1.00, 1.00],
      shininess: 180,
      alpha:     0.9,
      useTexture: false,
    };

    // Metal escuro para os naceles
    _matNacelle = {
      diffuse:   [0.25, 0.26, 0.30],
      ambient:   [0.08, 0.08, 0.10],
      specular:  [0.80, 0.80, 0.75],
      shininess: 60,
      alpha:     1.0,
      useTexture: false,
    };

    // Luz de pouso — amarelo-esverdeado emissivo
    _matRing = {
      diffuse:   [0.80, 1.00, 0.40],
      ambient:   [0.80, 1.00, 0.40],  // ambient alto = efeito emissivo
      specular:  [1.00, 1.00, 0.80],
      shininess: 10,
      alpha:     0.90,
      useTexture: false,
    };

    // Metal médio para as aletas
    _matFin = {
      diffuse:   [0.50, 0.52, 0.56],
      ambient:   [0.15, 0.15, 0.17],
      specular:  [0.70, 0.70, 0.65],
      shininess: 45,
      alpha:     1.0,
      useTexture: false,
    };
  }

  // ── getRenderObjects ──────────────────────────────────────
  function getRenderObjects() {
    const ac   = State.get().aircraft;
    const m4   = twgl.m4;
    const objs = [];

    // Raiz da hierarquia — posição + rotação da nave
    let root = m4.identity();
    root = m4.translate(root, ac.position);
    root = m4.rotateY(root, ac.rotation);
    root = m4.rotateX(root, ac.tiltX);
    root = m4.rotateZ(root, ac.tiltZ);

    // ── Casco principal (escalonado para tamanho final) ───
    const hullMat = m4.scale(root, [1, 1, 1]);
    objs.push({ bufferInfo: _hullBuf, material: _matHull, modelMat: hullMat });

    // ── Anel de luz ventral ───────────────────────────────
    objs.push({ bufferInfo: _ringBuf, material: _matRing, modelMat: m4.copy(root) });

    // ── Cúpula inferior (encaixa no buraco central do hull) 
    // yTop do hull = 0.55 → cúpula começa ali
    const domeLowMat = m4.translate(root, [0, 0.55, 0]);
    objs.push({ bufferInfo: _domeLowBuf, material: _matDomeLow, modelMat: domeLowMat });

    // ── Cúpula superior (no topo da inferior)
    // ry da dome low = 0.5 → sobe 0.5 unidades
    const domeTopMat = m4.translate(root, [0, 0.55 + 0.48, 0]);
    objs.push({ bufferInfo: _domeTopBuf, material: _matDomeTop, modelMat: domeTopMat });

    // ── 4 Naceles (motores) posicionados em cruz ──────────
    // Raio de 3.8 unidades do centro, na linha do equador (y=0)
    const nacellePositions = [
      [ 3.8, -0.05,  0.0],
      [-3.8, -0.05,  0.0],
      [ 0.0, -0.05,  3.8],
      [ 0.0, -0.05, -3.8],
    ];
    // Rotações para alinhar o eixo longo do nacele com a direção radial
    const nacelleRotations = [0, 0, Math.PI/2, Math.PI/2];

    for (let i = 0; i < 4; i++) {
      let nm = m4.translate(root, nacellePositions[i]);
      nm = m4.rotateY(nm, nacelleRotations[i]);
      objs.push({ bufferInfo: _nacelleBuf, material: _matNacelle, modelMat: nm });
    }

    // ── 4 Aletas decorativas entre os naceles (45°) ───────
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

  return { init, getRenderObjects };

})();