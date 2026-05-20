// ============================================================
// src/world/terrain.js — Terreno  (CORRIGIDO)
// ============================================================
const Terrain = (() => {
  let _groundBuf = null;
  let _roadBuf   = null;
  let _matGround = null;
  let _matRoad   = null;

  function _buildPlane(gl, size, uvRepeat) {
    const h = size / 2;
    const r = uvRepeat;

    //  ANTES (CW visto de cima → normal = -Y → culled):
    //    -h,0,-h  h,0,-h  h,0,h
    //    -h,0,-h  h,0,h  -h,0,h
    //
    //  DEPOIS (CCW visto de cima → normal = +Y → visível):
    //    Basta trocar B↔C em cada triângulo.
    //
    //  Verificação tri-1: A=(-h,0,-h) B=(h,0,h) C=(h,0,-h)
    //    edge1 = (2h,0,2h)  edge2 = (2h,0,0)
    //    normal = edge1×edge2 = (0, +4h², 0)  ✓  aponta para cima

    const positions = new Float32Array([
      // Triângulo 1
      -h, 0, -h,    h, 0,  h,    h, 0, -h,
      // Triângulo 2
      -h, 0, -h,   -h, 0,  h,    h, 0,  h,
    ]);
    const normals = new Float32Array([
      0,1,0, 0,1,0, 0,1,0,
      0,1,0, 0,1,0, 0,1,0,
    ]);
    // Texcoords ajustadas ao novo winding
    const texcoords = new Float32Array([
      0,0,  r,r,  r,0,   // tri 1
      0,0,  0,r,  r,r,   // tri 2
    ]);

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: positions },
      a_normal:   { numComponents: 3, data: normals   },
      a_texcoord: { numComponents: 2, data: texcoords },
    });
  }

  function _buildRoadSegment(gl, length, width) {
    const hl = length / 2, hw = width / 2;

    // Mesmo problema: winding CW → normal aponta para baixo → culled.
    // Correção idêntica: trocar B↔C em cada triângulo.

    const positions = new Float32Array([
      // Triângulo 1
      -hw, 0.01, -hl,    hw, 0.01,  hl,    hw, 0.01, -hl,
      // Triângulo 2
      -hw, 0.01, -hl,   -hw, 0.01,  hl,    hw, 0.01,  hl,
    ]);
    const normals = new Float32Array([
      0,1,0, 0,1,0, 0,1,0,
      0,1,0, 0,1,0, 0,1,0,
    ]);
    const texcoords = new Float32Array([
      0,0,  1,5,  1,0,   // tri 1
      0,0,  0,5,  1,5,   // tri 2
    ]);

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: positions },
      a_normal:   { numComponents: 3, data: normals   },
      a_texcoord: { numComponents: 2, data: texcoords },
    });
  }

  function init(gl, textures) {
    const S    = CONSTANTS.WORLD.SIZE;
    _groundBuf = _buildPlane(gl, S, S / 8);
    _roadBuf   = _buildRoadSegment(gl, S, CONSTANTS.WORLD.ROAD_WIDTH);

    _matGround = {
      ...Material.PRESETS.grass,
      texture: textures.grass, useTexture: true,
    };
    _matRoad = {
      ...Material.PRESETS.asphalt,
      texture: textures.road,  useTexture: true,
    };
  }

  function getRenderObjects() {
    const m4   = twgl.m4;
    const S    = CONSTANTS.WORLD.SIZE;
    const objs = [];

    objs.push({
      bufferInfo: _groundBuf,
      material:   _matGround,
      modelMat:   m4.identity(),
    });

    const cells   = CONSTANTS.WORLD.GRID_CELLS;
    const spacing = S / cells;
    const half    = S / 2;

    for (let i = 0; i <= cells; i++) {
      const pos = -half + i * spacing;

      objs.push({
        bufferInfo: _roadBuf,
        material:   _matRoad,
        modelMat:   m4.translate(m4.identity(), [pos, 0, 0]),
      });

      objs.push({
        bufferInfo: _roadBuf,
        material:   _matRoad,
        modelMat:   m4.rotateY(m4.translate(m4.identity(), [0, 0, pos]), Math.PI / 2),
      });
    }

    return objs;
  }

  return { init, getRenderObjects };
})();