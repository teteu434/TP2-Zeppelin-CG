// ============================================================
// src/world/terrain.js — Terreno
// Responsabilidade: gerar o plano base e as ruas da cidade.
// ============================================================

const Terrain = (() => {

  let _groundBuf = null;
  let _roadBuf   = null;
  let _matGround = null;
  let _matRoad   = null;

  // Plano simples (dois triângulos)
  function _buildPlane(gl, size, uvRepeat) {
    const h = size / 2;
    const r = uvRepeat;

    const positions = new Float32Array([
      -h,0,-h,  h,0,-h,  h,0, h,
      -h,0,-h,  h,0, h, -h,0, h,
    ]);
    const normals = new Float32Array([
      0,1,0, 0,1,0, 0,1,0,
      0,1,0, 0,1,0, 0,1,0,
    ]);
    const texcoords = new Float32Array([
      0,0, r,0, r,r,
      0,0, r,r, 0,r,
    ]);

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: positions },
      a_normal:   { numComponents: 3, data: normals },
      a_texcoord: { numComponents: 2, data: texcoords },
    });
  }

  // Rua: plano fino ao longo de um eixo
  function _buildRoadSegment(gl, length, width) {
    const hl = length / 2, hw = width / 2;
    const positions = new Float32Array([
      -hw, 0.01, -hl,   hw, 0.01, -hl,   hw, 0.01,  hl,
      -hw, 0.01, -hl,   hw, 0.01,  hl,  -hw, 0.01,  hl,
    ]);
    const normals = new Float32Array([
      0,1,0, 0,1,0, 0,1,0,
      0,1,0, 0,1,0, 0,1,0,
    ]);
    const texcoords = new Float32Array([
      0,0, 1,0, 1,5,
      0,0, 1,5, 0,5,
    ]);
    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: positions },
      a_normal:   { numComponents: 3, data: normals },
      a_texcoord: { numComponents: 2, data: texcoords },
    });
  }

  function init(gl, textures) {
    const S = CONSTANTS.WORLD.SIZE;
    _groundBuf = _buildPlane(gl, S, S / 8);         // UV repeat para textura de grama
    _roadBuf   = _buildRoadSegment(gl, S, CONSTANTS.WORLD.ROAD_WIDTH);

    _matGround = {
      ...Material.PRESETS.grass,
      texture: textures.grass, useTexture: true,
    };
    _matRoad = {
      ...Material.PRESETS.asphalt,
      texture: textures.road, useTexture: true,
    };
  }

  // Retorna todos os render objects do terreno
  function getRenderObjects() {
    const m4   = twgl.m4;
    const S    = CONSTANTS.WORLD.SIZE;
    const objs = [];

    // Plano de grama base
    objs.push({
      bufferInfo: _groundBuf,
      material:   _matGround,
      modelMat:   m4.identity(),
    });

    // Grade de ruas (linhas X e Z a cada WORLD.SIZE / GRID_CELLS)
    const cells   = CONSTANTS.WORLD.GRID_CELLS;
    const spacing = S / cells;
    const half    = S / 2;

    for (let i = 0; i <= cells; i++) {
      const pos = -half + i * spacing;

      // Rua ao longo de Z (paralela ao eixo Z)
      objs.push({
        bufferInfo: _roadBuf,
        material:   _matRoad,
        modelMat:   m4.translate(m4.identity(), [pos, 0, 0]),
      });

      // Rua ao longo de X (girada 90°)
      objs.push({
        bufferInfo: _roadBuf,
        material:   _matRoad,
        modelMat:   m4.rotateY(m4.translate(m4.identity(), [0, 0, pos]), Math.PI/2),
      });
    }

    return objs;
  }

  return { init, getRenderObjects };

})();