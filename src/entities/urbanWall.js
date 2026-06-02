// ============================================================
// src/entities/urbanWall.js — Muros Urbanos
// Geometria: caixa retangular baixa e longa (unitária escalada)
// ============================================================

const UrbanWall = (() => {

  let _boxBuf      = null;
  let _matConcrete = null;
  let _matBrick    = null;

  function _buildUnitBox(gl) {
    const positions = [], normals = [], texcoords = [];

    function face(verts, normal, uvs) {
      const tris = [[0,1,2],[0,2,3]];
      for (const t of tris) for (const i of t) {
        positions.push(...verts[i]);
        normals.push(...normal);
        texcoords.push(...uvs[i]);
      }
    }

    face([[0,0,1],[1,0,1],[1,1,1],[0,1,1]], [0,0,1],  [[0,0],[1,0],[1,1],[0,1]]);
    face([[1,0,0],[0,0,0],[0,1,0],[1,1,0]], [0,0,-1], [[0,0],[1,0],[1,1],[0,1]]);
    face([[1,0,1],[1,0,0],[1,1,0],[1,1,1]], [1,0,0],  [[0,0],[1,0],[1,1],[0,1]]);
    face([[0,0,0],[0,0,1],[0,1,1],[0,1,0]], [-1,0,0], [[0,0],[1,0],[1,1],[0,1]]);
    face([[0,1,1],[1,1,1],[1,1,0],[0,1,0]], [0,1,0],  [[0,0],[1,0],[1,1],[0,1]]);
    face([[0,0,0],[1,0,0],[1,0,1],[0,0,1]], [0,-1,0], [[0,0],[1,0],[1,1],[0,1]]);

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  function init(gl, textures) {
    _boxBuf = _buildUnitBox(gl);

    _matConcrete = { ...Material.PRESETS.concrete };
    if (textures && textures.building_concrete) {
      _matConcrete.texture    = textures.building_concrete;
      _matConcrete.useTexture = true;
    }

    _matBrick = { ...Material.PRESETS.brick };
    if (textures && textures.building_brick) {
      _matBrick.texture    = textures.building_brick;
      _matBrick.useTexture = true;
    }
  }

  // config = { x, z, length, useBrick }
  // length: comprimento do muro (8–18). Espessura 0.6, altura 2.5.
  function getRenderObjects(config) {
    const { x, z, length = 10.0, useBrick = false } = config;
    const m4  = twgl.m4;

    const height    = 2.5;
    const thickness = 0.6;
    const mat       = useBrick ? _matBrick : _matConcrete;

    const wallMat = m4.scale(
      m4.translate(m4.identity(), [x - length/2, 0, z - thickness/2]),
      [length, height, thickness]
    );

    return [{ bufferInfo: _boxBuf, material: mat, modelMat: wallMat }];
  }

  return { init, getRenderObjects };

})();
