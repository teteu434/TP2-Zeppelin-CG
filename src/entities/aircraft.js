// ============================================================
// src/entities/aircraft.js — Aeronave (Disco Voador)
// Responsabilidade: geometria, hierarquia e renderização da aeronave.
//
// ESTRUTURA HIERÁRQUICA:
//   Root (posição + rotação do avião)
//   ├── Corpo Principal (disco achatado)
//   ├── Cabine (domo de vidro no topo)
//   └── Anel Rotor (rotação contínua)
//       ├── Pá 1
//       ├── Pá 2
//       └── Pá 3
//
// HIERARQUIA DE TRANSFORMAÇÕES:
//   modelFinal = parentMatrix × localMatrix
//   As peças "filhas" herdam posição/rotação do pai.
//   Isso é feito manualmente multiplicando as matrizes.
//
// GEOMETRIA PROCEDURAL:
//   Usamos twgl.createBufferInfoFromArrays() com arrays de vértices
//   construídos via loops trigonométricos (cilindros, discos, cones).
// ============================================================

const Aircraft = (() => {

  // Buffers de geometria (criados uma vez na GPU)
  let _bodyBuf   = null;
  let _cabineBuf = null;
  let _rotorBuf  = null;
  let _bladeBuf  = null;

  // Materiais
  let _matBody   = null;
  let _matCabine = null;
  let _matRotor  = null;

  // ── Geometria: disco achatado ─────────────────────────────────
  // Um cilindro muito achatado com topo arredondado
  function _buildBody(gl) {
    const segs   = 32;   // Segmentos do círculo (mais = mais suave)
    const radius = 4.5;
    const height = 1.0;

    const positions = [];
    const normals   = [];
    const texcoords = [];

    // Face inferior (disco plano)
    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;

      // Triângulo: centro, borda0, borda1
      positions.push(0, 0, 0);
      positions.push(Math.cos(a0) * radius, 0, Math.sin(a0) * radius);
      positions.push(Math.cos(a1) * radius, 0, Math.sin(a1) * radius);

      // Normais apontando para baixo
      normals.push(0,-1,0, 0,-1,0, 0,-1,0);
      texcoords.push(0.5,0.5, Math.cos(a0)*0.5+0.5, Math.sin(a0)*0.5+0.5,
                     Math.cos(a1)*0.5+0.5, Math.sin(a1)*0.5+0.5);
    }

    // Lateral + topo arredondado
    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;

      // Lateral do disco
      const bx0 = Math.cos(a0) * radius, bz0 = Math.sin(a0) * radius;
      const bx1 = Math.cos(a1) * radius, bz1 = Math.sin(a1) * radius;

      positions.push(bx0, 0, bz0,  bx1, height, bz1,  bx0, height, bz0);
      positions.push(bx0, 0, bz0,  bx1, 0,      bz1,  bx1, height, bz1);

      const nx0 = Math.cos(a0), nz0 = Math.sin(a0);
      const nx1 = Math.cos(a1), nz1 = Math.sin(a1);
      normals.push(nx0,0,nz0, nx1,0,nz1, nx0,0,nz0,
                   nx0,0,nz0, nx1,0,nz1, nx1,0,nz1);
      texcoords.push(0,0, 1,1, 0,1, 0,0, 1,0, 1,1);
    }

    // Topo (face plana superior — borda interna da cabine)
    const innerR = 1.6;
    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;

      const ox0 = Math.cos(a0) * radius,  oz0 = Math.sin(a0) * radius;
      const ox1 = Math.cos(a1) * radius,  oz1 = Math.sin(a1) * radius;
      const ix0 = Math.cos(a0) * innerR,  iz0 = Math.sin(a0) * innerR;
      const ix1 = Math.cos(a1) * innerR,  iz1 = Math.sin(a1) * innerR;

      positions.push(ox0,height,oz0, ox1,height,oz1, ix1,height,iz1);
      positions.push(ox0,height,oz0, ix1,height,iz1, ix0,height,iz0);
      normals.push(0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0);
      texcoords.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  // ── Geometria: domo da cabine ─────────────────────────────────
  // Semiesfera (dome) para a bolha de vidro
  function _buildCabine(gl) {
    const stacks  = 12;
    const slices  = 24;
    const radius  = 1.6;

    const positions = [], normals = [], texcoords = [];

    // Semiesfera: stacks × slices usando coordenadas esféricas
    for (let st = 0; st < stacks; st++) {
      const phi0 = (st     / stacks) * Math.PI * 0.5;  // [0, π/2] = semiesfera
      const phi1 = ((st+1) / stacks) * Math.PI * 0.5;

      for (let sl = 0; sl < slices; sl++) {
        const th0 = (sl     / slices) * Math.PI * 2;
        const th1 = ((sl+1) / slices) * Math.PI * 2;

        // 4 pontos do "quadrilátero" na esfera
        const pts = [
          [phi0, th0], [phi1, th0],
          [phi1, th1], [phi0, th1],
        ].map(([ph, th]) => [
          Math.sin(ph) * Math.cos(th) * radius,
          Math.cos(ph) * radius,
          Math.sin(ph) * Math.sin(th) * radius,
        ]);

        // Normais = vetor normalizado da origem ao ponto (na esfera, normal = posição/radius)
        const nrm = pts.map(p => [p[0]/radius, p[1]/radius, p[2]/radius]);

        // Dois triângulos por quadrilátero
        const triIndices = [[0,1,2], [0,2,3]];
        for (const tri of triIndices) {
          for (const idx of tri) {
            positions.push(...pts[idx]);
            normals.push(...nrm[idx]);
            texcoords.push(sl / slices, st / stacks);
          }
        }
      }
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  // ── Geometria: anel rotor ─────────────────────────────────────
  function _buildRotor(gl) {
    const segs    = 40;
    const outerR  = 5.5;
    const innerR  = 4.8;
    const thick   = 0.15;

    const positions = [], normals = [], texcoords = [];

    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;

      const ox0 = Math.cos(a0) * outerR, oz0 = Math.sin(a0) * outerR;
      const ox1 = Math.cos(a1) * outerR, oz1 = Math.sin(a1) * outerR;
      const ix0 = Math.cos(a0) * innerR, iz0 = Math.sin(a0) * innerR;
      const ix1 = Math.cos(a1) * innerR, iz1 = Math.sin(a1) * innerR;

      // Topo do anel
      positions.push(ox0,thick,oz0, ox1,thick,oz1, ix1,thick,iz1,
                     ox0,thick,oz0, ix1,thick,iz1, ix0,thick,iz0);
      normals.push(0,1,0,0,1,0,0,1,0, 0,1,0,0,1,0,0,1,0);
      texcoords.push(0,0,1,0,1,1, 0,0,1,1,0,1);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  // ── Geometria: pá da hélice ───────────────────────────────────
  function _buildBlade(gl) {
    // Pá simples: caixa fina e comprida
    const l = 3.5, w = 0.4, h = 0.08;
    const positions = [
      // Topo
      -l,h, w,  l,h, w,  l,h,-w,   -l,h, w,  l,h,-w,  -l,h,-w,
      // Fundo
      -l,0, w,  l,0,-w,  l,0, w,   -l,0, w,  -l,0,-w,  l,0,-w,
      // Frente
      -l,h, w,  -l,0, w,  l,0, w,   -l,h, w,  l,0, w,  l,h, w,
      // Trás
      -l,h,-w,   l,h,-w,  l,0,-w,  -l,h,-w,  l,0,-w, -l,0,-w,
    ];
    const normals = [
      0,1,0,0,1,0,0,1,0, 0,1,0,0,1,0,0,1,0,
      0,-1,0,0,-1,0,0,-1,0, 0,-1,0,0,-1,0,0,-1,0,
      0,0,1,0,0,1,0,0,1, 0,0,1,0,0,1,0,0,1,
      0,0,-1,0,0,-1,0,0,-1, 0,0,-1,0,0,-1,0,0,-1,
    ];
    const tc = Array(positions.length / 3 * 2).fill(0);

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(tc) },
    });
  }

  // ── Inicialização ─────────────────────────────────────────────
  function init(gl, textures) {
    _bodyBuf   = _buildBody(gl);
    _cabineBuf = _buildCabine(gl);
    _rotorBuf  = _buildRotor(gl);
    _bladeBuf  = _buildBlade(gl);

    _matBody   = { ...Material.PRESETS.metalLight,
                   texture: textures.metal, useTexture: true };
    _matCabine = { ...Material.PRESETS.cabineGlass };
    _matRotor  = { ...Material.PRESETS.metalDark };
  }

  // ── Renderização hierárquica ──────────────────────────────────
  // TRANSFORMAÇÕES HIERÁRQUICAS:
  //   1. Calcula matrix raiz (posição + yaw + tilt do avião)
  //   2. Cada parte multiplica sua matrix LOCAL pela do PAI
  //   3. O rotor tem sua própria rotação que se adiciona à do avião
  function getRenderObjects() {
    const ac   = State.get().aircraft;
    const m4   = twgl.m4;
    const objs = [];

    // ── Matrix raiz do avião ──────────────────────────────────
    let root = m4.identity();
    root = m4.translate(root, ac.position);              // Posição no mundo
    root = m4.rotateY(root, ac.rotation);               // Yaw (giro no eixo Y)
    root = m4.rotateX(root, ac.tiltX);                  // Tilt frente/trás
    root = m4.rotateZ(root, ac.tiltZ);                  // Tilt lateral

    // ── 1. Corpo ──────────────────────────────────────────────
    const bodyMat = m4.copy(root);
    objs.push({ bufferInfo: _bodyBuf, material: _matBody, modelMat: bodyMat });

    // ── 2. Cabine (herdada do root + offset vertical) ─────────
    let cabineMat = m4.translate(root, [0, 1.0, 0]);
    objs.push({ bufferInfo: _cabineBuf, material: _matCabine, modelMat: cabineMat });

    // ── 3. Anel rotor (rotação contínua) ─────────────────────
    // A matrix do rotor = root × rotação própria
    let rotorMat = m4.translate(root, [0, 0.5, 0]);
    rotorMat = m4.rotateY(rotorMat, ac.rotorAngle);  // Rotação contínua!
    objs.push({ bufferInfo: _rotorBuf, material: _matRotor, modelMat: rotorMat });

    // ── 4. Pás da hélice (3 pás a 120° cada) ─────────────────
    const numBlades = 3;
    for (let i = 0; i < numBlades; i++) {
      const bladeAngle = (i / numBlades) * Math.PI * 2;
      let bladeMat = m4.translate(root, [0, 0.6, 0]);
      bladeMat = m4.rotateY(bladeMat, ac.rotorAngle + bladeAngle);
      bladeMat = m4.translate(bladeMat, [2.5, 0, 0]);  // Offset do centro
      objs.push({ bufferInfo: _bladeBuf, material: _matRotor, modelMat: bladeMat });
    }

    return objs;
  }

  return { init, getRenderObjects };

})();