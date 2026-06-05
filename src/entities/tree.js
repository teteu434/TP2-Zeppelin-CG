// ============================================================
// src/entities/tree.js — Árvores
// Responsabilidade: geometria de árvores (tronco + copa).
//
// Cada árvore tem:
//   - Tronco: cilindro (aproximado por prisma de N lados)
//   - Copa:   cone (pirâmide suavizada) ou esfera achatada
// ============================================================

const Tree = (() => {

  let _trunkBuf = null;
  let _leaveBuf = null;
  let _matTrunk = null;
  let _matLeave = null;

  // Cilindro simples para o tronco
  function _buildCylinder(gl, radius, height, segs) {
    const positions = [], normals = [], texcoords = [];

    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;

      const x0 = Math.cos(a0) * radius, z0 = Math.sin(a0) * radius;
      const x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;

      // Lateral
      positions.push(x0,0,z0, x1,height,z1, x0,height,z0);
      positions.push(x0,0,z0, x1,0,     z1, x1,height,z1);
      normals.push(x0/radius,0,z0/radius, x1/radius,0,z1/radius, x0/radius,0,z0/radius,
                   x0/radius,0,z0/radius, x1/radius,0,z1/radius, x1/radius,0,z1/radius);
      texcoords.push(0,0, 1,1, 0,1, 0,0, 1,0, 1,1);

      // Tampa superior
      positions.push(0,height,0, x0,height,z0, x1,height,z1);
      normals.push(0,1,0, 0,1,0, 0,1,0);
      texcoords.push(0.5,0.5, 0,0, 1,0);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  // Cone para a copa
  function _buildCone(gl, radius, height, segs) {
    const positions = [], normals = [], texcoords = [];
    const apex = [0, height, 0];

    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;

      const b0 = [Math.cos(a0)*radius, 0, Math.sin(a0)*radius];
      const b1 = [Math.cos(a1)*radius, 0, Math.sin(a1)*radius];

      // Face lateral
      positions.push(...b0, ...b1, ...apex);
      const n = [0, 0.5, 0];  // Normal aproximada apontando para cima/fora
      normals.push(...n, ...n, ...n);
      texcoords.push(0,0, 1,0, 0.5,1);

      // Base (opcional, não visível de cima)
      positions.push(0,0,0, ...b1, ...b0);
      normals.push(0,-1,0, 0,-1,0, 0,-1,0);
      texcoords.push(0.5,0.5, 1,0, 0,0);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  function init(gl, textures) {
    _trunkBuf = _buildCylinder(gl, 0.35, 1.0, 8);
    _leaveBuf = _buildCone(gl, 1.0, 1.0, 10);

    _matTrunk = { ...Material.PRESETS.wood,
                  texture: textures.bark, useTexture: true };
    _matLeave = { ...Material.PRESETS.leaves };
  }

  // config = { x, z, trunkHeight, crownRadius, crownHeight, terrainY }
  function getRenderObjects(config) {
    const { x, z, trunkHeight = 4, crownRadius = 2.5, crownHeight = 5, terrainY = 0 } = config;
    const m4 = twgl.m4;
    const objs = [];

    // Tronco — base alinhada ao terreno
    const trunkMat = m4.scale(
      m4.translate(m4.identity(), [x, terrainY, z]),
      [1, trunkHeight, 1]
    );
    objs.push({ bufferInfo: _trunkBuf, material: _matTrunk, modelMat: trunkMat });

    // Copa (cone na ponta do tronco)
    const crownMat = m4.scale(
      m4.translate(m4.identity(), [x, terrainY + trunkHeight, z]),
      [crownRadius, crownHeight, crownRadius]
    );
    objs.push({ bufferInfo: _leaveBuf, material: _matLeave, modelMat: crownMat });

    return objs;
  }

  return { init, getRenderObjects };

})();