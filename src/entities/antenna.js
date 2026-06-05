// ============================================================
// src/entities/antenna.js — Antenas de Telecomunicação
// Geometria: base de ancoragem + torre vertical + hastes cruzadas + ponta fina
// ============================================================

const Antenna = (() => {

  let _boxBuf   = null;
  let _tipBuf   = null;
  let _matMetal = null;

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

  function _buildCylinder(gl, radius, height, segs) {
    const positions = [], normals = [], texcoords = [];

    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;
      const x0 = Math.cos(a0)*radius, z0 = Math.sin(a0)*radius;
      const x1 = Math.cos(a1)*radius, z1 = Math.sin(a1)*radius;

      positions.push(x0,0,z0, x1,0,z1, x1,height,z1);
      positions.push(x0,0,z0, x1,height,z1, x0,height,z0);
      const nx0=x0/radius, nz0=z0/radius, nx1=x1/radius, nz1=z1/radius;
      normals.push(nx0,0,nz0, nx1,0,nz1, nx1,0,nz1);
      normals.push(nx0,0,nz0, nx1,0,nz1, nx0,0,nz0);
      texcoords.push(0,0,1,0,1,1, 0,0,1,1,0,1);

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

  function init(gl, textures) {
    _boxBuf   = _buildUnitBox(gl);
    _tipBuf   = _buildCylinder(gl, 0.12, 1.0, 6);

    _matMetal = {
      diffuse:    [0.25, 0.25, 0.28],
      ambient:    [0.05, 0.05, 0.06],
      specular:   [0.7, 0.7, 0.75],
      shininess:  80,
      alpha:      1.0,
      texture:    null,
      useTexture: false,
    };
  }

  // config = { x, z, terrainY }
  function getRenderObjects(config) {
    const { x, z, terrainY = 0 } = config;
    const m4   = twgl.m4;
    const objs = [];

    const towerH = 20.0;
    const towerW = 0.45;

    // Base de ancoragem: alinhada ao terreno
    const baseMat = m4.scale(
      m4.translate(m4.identity(), [x - 0.9, terrainY, z - 0.9]),
      [1.8, 0.5, 1.8]
    );
    objs.push({ bufferInfo: _boxBuf, material: _matMetal, modelMat: baseMat });

    // Torre principal
    const towerMat = m4.scale(
      m4.translate(m4.identity(), [x - towerW/2, terrainY + 0.5, z - towerW/2]),
      [towerW, towerH, towerW]
    );
    objs.push({ bufferInfo: _boxBuf, material: _matMetal, modelMat: towerMat });

    // 3 pares de hastes cruzadas em alturas distribuídas
    const hasteYs  = [towerH * 0.28, towerH * 0.56, towerH * 0.82];
    const hasteLen = 3.2;
    const hasteW   = 0.18;

    for (const hy of hasteYs) {
      const hxMat = m4.scale(
        m4.translate(m4.identity(), [x - hasteLen/2, terrainY + 0.5 + hy, z - hasteW/2]),
        [hasteLen, hasteW, hasteW]
      );
      objs.push({ bufferInfo: _boxBuf, material: _matMetal, modelMat: hxMat });

      const hzMat = m4.scale(
        m4.translate(m4.identity(), [x - hasteW/2, terrainY + 0.5 + hy + hasteW + 0.1, z - hasteLen/2]),
        [hasteW, hasteW, hasteLen]
      );
      objs.push({ bufferInfo: _boxBuf, material: _matMetal, modelMat: hzMat });
    }

    // Ponta: cilindro fino de 5 unidades no topo da torre
    const tipMat = m4.scale(
      m4.translate(m4.identity(), [x, terrainY + 0.5 + towerH, z]),
      [1, 5.0, 1]
    );
    objs.push({ bufferInfo: _tipBuf, material: _matMetal, modelMat: tipMat });

    return objs;
  }

  return { init, getRenderObjects };

})();
