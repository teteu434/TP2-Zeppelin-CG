// ============================================================
// src/entities/aircraft.js — Aeronave (CORRIGIDO)
// ============================================================

const Aircraft = (() => {

  let _bodyBuf   = null;
  let _cabineBuf = null;
  let _rotorBuf  = null;
  let _bladeBuf  = null;

  let _matBody   = null;
  let _matCabine = null;
  let _matRotor  = null;

  function _buildBody(gl) {
    const segs   = 32;
    const radius = 4.5;
    const height = 1.0;

    const positions = [];
    const normals   = [];
    const texcoords = [];

    // ── Face inferior (disco plano) — normal -Y, visível de baixo ──
    // Winding CW visto de cima = CCW visto de baixo = front face para baixo ✓
    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;
      positions.push(0, 0, 0);
      positions.push(Math.cos(a0) * radius, 0, Math.sin(a0) * radius);
      positions.push(Math.cos(a1) * radius, 0, Math.sin(a1) * radius);
      normals.push(0,-1,0, 0,-1,0, 0,-1,0);
      texcoords.push(0.5,0.5,
                     Math.cos(a0)*0.5+0.5, Math.sin(a0)*0.5+0.5,
                     Math.cos(a1)*0.5+0.5, Math.sin(a1)*0.5+0.5);
    }

    // ── Lateral do cilindro ────────────────────────────────────────
    // FIX: winding original era CW visto de fora → normal apontava para dentro.
    // Troca: v1↔v2 em cada triângulo → CCW visto de fora → normal para fora ✓
    //
    // Verificação tri-1 (a0=0): A=(r,0,0) B=(r,h,0) C=(r,h,εr)
    //   edge1=(0,h,0)  edge2=(0,h,εr)
    //   normal.x = h·εr − 0·h = hεr > 0  ✓  aponta para +X (fora do cilindro)
    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;

      const bx0 = Math.cos(a0) * radius, bz0 = Math.sin(a0) * radius;
      const bx1 = Math.cos(a1) * radius, bz1 = Math.sin(a1) * radius;
      const nx0 = Math.cos(a0), nz0 = Math.sin(a0);
      const nx1 = Math.cos(a1), nz1 = Math.sin(a1);

      // ANTES: bx0,0,bz0  bx1,h,bz1  bx0,h,bz0  (normal interna)
      // DEPOIS: bx0,0,bz0  bx0,h,bz0  bx1,h,bz1  (normal externa ✓)
      positions.push(bx0, 0,      bz0,  bx0, height, bz0,  bx1, height, bz1);
      positions.push(bx0, 0,      bz0,  bx1, height, bz1,  bx1, 0,      bz1);

      normals.push(nx0,0,nz0, nx0,0,nz0, nx1,0,nz1,
                   nx0,0,nz0, nx1,0,nz1, nx1,0,nz1);
      texcoords.push(0,0, 0,1, 1,1,  0,0, 1,1, 1,0);
    }

    // ── Topo (anel entre borda e abertura da cabine) ───────────────
    // FIX: mesmo padrão que o terreno — winding CW → normal para baixo.
    // Troca: v1 e v2 de cada triângulo → normal para cima ✓
    //
    // Verificação: A=(r,h,0) B=(inner,h,εr) C=(r,h,εr)
    //   edge1=(inner-r,0,εr)  edge2=(0,0,εr)... avaliado em ângulos maiores:
    //   normal.y = 9.23 > 0  ✓
    const innerR = 1.6;
    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;

      const ox0 = Math.cos(a0) * radius,  oz0 = Math.sin(a0) * radius;
      const ox1 = Math.cos(a1) * radius,  oz1 = Math.sin(a1) * radius;
      const ix0 = Math.cos(a0) * innerR,  iz0 = Math.sin(a0) * innerR;
      const ix1 = Math.cos(a1) * innerR,  iz1 = Math.sin(a1) * innerR;

      // ANTES: ox0,ox1,ix1 / ox0,ix1,ix0  (normal para baixo)
      // DEPOIS: ox0,ix1,ox1 / ox0,ix0,ix1  (normal para cima ✓)
      positions.push(ox0,height,oz0, ix1,height,iz1, ox1,height,oz1);
      positions.push(ox0,height,oz0, ix0,height,iz0, ix1,height,iz1);
      normals.push(0,1,0, 0,1,0, 0,1,0,  0,1,0, 0,1,0, 0,1,0);
      texcoords.push(0,0, 1,1, 1,0,  0,0, 0,1, 1,1);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  function _buildCabine(gl) {
    const stacks  = 12;
    const slices  = 24;
    const radius  = 1.6;

    const positions = [], normals = [], texcoords = [];

    for (let st = 0; st < stacks; st++) {
      const phi0 = (st     / stacks) * Math.PI * 0.5;
      const phi1 = ((st+1) / stacks) * Math.PI * 0.5;

      for (let sl = 0; sl < slices; sl++) {
        const th0 = (sl     / slices) * Math.PI * 2;
        const th1 = ((sl+1) / slices) * Math.PI * 2;

        const pts = [
          [phi0, th0], [phi1, th0],
          [phi1, th1], [phi0, th1],
        ].map(([ph, th]) => [
          Math.sin(ph) * Math.cos(th) * radius,
          Math.cos(ph) * radius,
          Math.sin(ph) * Math.sin(th) * radius,
        ]);

        const nrm = pts.map(p => [p[0]/radius, p[1]/radius, p[2]/radius]);

        // FIX: winding original [0,1,2][0,2,3] produzia normal para DENTRO da esfera.
        // Invertendo a ordem de cada triângulo → normal aponta para fora ✓
        //
        // Verificação: tri [0,2,1] com pts[0]=(0,r,0), pts[2]=(ε,r,δ), pts[1]=(ε,r,0)
        //   normal resultante aponta radialmente para fora da origem ✓
        const triIndices = [[0,2,1], [0,3,2]]; // ANTES: [0,1,2],[0,2,3]
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

      // FIX: mesmo padrão do top ring do corpo — troca v1↔v2 para virar normal ✓
      // ANTES: ox0,ox1,ix1 / ox0,ix1,ix0  (normal para baixo)
      // DEPOIS: ox0,ix1,ox1 / ox0,ix0,ix1  (normal para cima ✓)
      positions.push(ox0,thick,oz0, ix1,thick,iz1, ox1,thick,oz1,
                     ox0,thick,oz0, ix0,thick,iz0, ix1,thick,iz1);
      normals.push(0,1,0,0,1,0,0,1,0,  0,1,0,0,1,0,0,1,0);
      texcoords.push(0,0,1,1,1,0,  0,0,0,1,1,1);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  // _buildBlade — geometria correta, sem alterações
  function _buildBlade(gl) {
    const l = 3.5, w = 0.4, h = 0.08;
    const positions = [
      -l,h, w,  l,h, w,  l,h,-w,   -l,h, w,  l,h,-w,  -l,h,-w,
      -l,0, w,  l,0,-w,  l,0, w,   -l,0, w,  -l,0,-w,  l,0,-w,
      -l,h, w,  -l,0, w,  l,0, w,   -l,h, w,  l,0, w,  l,h, w,
      -l,h,-w,   l,h,-w,  l,0,-w,  -l,h,-w,  l,0,-w, -l,0,-w,
    ];
    const normals = [
      0,1,0,0,1,0,0,1,0,   0,1,0,0,1,0,0,1,0,
      0,-1,0,0,-1,0,0,-1,0, 0,-1,0,0,-1,0,0,-1,0,
      0,0,1,0,0,1,0,0,1,   0,0,1,0,0,1,0,0,1,
      0,0,-1,0,0,-1,0,0,-1, 0,0,-1,0,0,-1,0,0,-1,
    ];
    const tc = Array(positions.length / 3 * 2).fill(0);
    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(tc) },
    });
  }

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

  function getRenderObjects() {
    const ac   = State.get().aircraft;
    const m4   = twgl.m4;
    const objs = [];

    let root = m4.identity();
    root = m4.translate(root, ac.position);
    root = m4.rotateY(root, ac.rotation);
    root = m4.rotateX(root, ac.tiltX);
    root = m4.rotateZ(root, ac.tiltZ);

    objs.push({ bufferInfo: _bodyBuf,   material: _matBody,   modelMat: m4.copy(root) });
    objs.push({ bufferInfo: _cabineBuf, material: _matCabine,
                modelMat: m4.translate(root, [0, 1.0, 0]) });

    let rotorMat = m4.translate(root, [0, 0.5, 0]);
    rotorMat = m4.rotateY(rotorMat, ac.rotorAngle);
    objs.push({ bufferInfo: _rotorBuf, material: _matRotor, modelMat: rotorMat });

    const numBlades = 3;
    for (let i = 0; i < numBlades; i++) {
      const bladeAngle = (i / numBlades) * Math.PI * 2;
      let bladeMat = m4.translate(root, [0, 0.6, 0]);
      bladeMat = m4.rotateY(bladeMat, ac.rotorAngle + bladeAngle);
      bladeMat = m4.translate(bladeMat, [2.5, 0, 0]);
      objs.push({ bufferInfo: _bladeBuf, material: _matRotor, modelMat: bladeMat });
    }

    return objs;
  }

  return { init, getRenderObjects };

})();