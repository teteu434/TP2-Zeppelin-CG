// ============================================================
// src/entities/waterTower.js — Caixas D'Água
// Geometria: 4 pernas cilíndricas + tanque cilíndrico + tampa cônica
// ============================================================

const WaterTower = (() => {

  let _legBuf   = null;
  let _tankBuf  = null;
  let _coneBuf  = null;
  let _matLeg   = null;
  let _matTank  = null;

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

  function _buildCone(gl, radius, height, segs) {
    const positions = [], normals = [], texcoords = [];

    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;
      const b0 = [Math.cos(a0)*radius, 0, Math.sin(a0)*radius];
      const b1 = [Math.cos(a1)*radius, 0, Math.sin(a1)*radius];
      const apex = [0, height, 0];

      const e1 = [apex[0]-b0[0], apex[1]-b0[1], apex[2]-b0[2]];
      const e2 = [b1[0]-b0[0],   b1[1]-b0[1],   b1[2]-b0[2]];
      const nx = e1[1]*e2[2] - e1[2]*e2[1];
      const ny = e1[2]*e2[0] - e1[0]*e2[2];
      const nz = e1[0]*e2[1] - e1[1]*e2[0];
      const len = Math.sqrt(nx*nx+ny*ny+nz*nz) || 1;
      const n = [nx/len, ny/len, nz/len];

      positions.push(...b0, ...apex, ...b1);
      normals.push(...n, ...n, ...n);
      texcoords.push(0,0, 0.5,1, 1,0);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  function init(gl, textures) {
    _legBuf  = _buildCylinder(gl, 0.18, 1.0, 6);
    _tankBuf = _buildCylinder(gl, 2.5, 3.2, 12);
    _coneBuf = _buildCone(gl, 2.5, 1.6, 12);

    _matLeg = {
      diffuse:    [0.35, 0.20, 0.10],
      ambient:    [0.12, 0.07, 0.03],
      specular:   [0.08, 0.05, 0.02],
      shininess:  6,
      alpha:      1.0,
      texture:    null,
      useTexture: false,
    };

    _matTank = {
      ...Material.PRESETS.concrete,
      diffuse: [0.55, 0.48, 0.38],
      ambient: [0.14, 0.12, 0.09],
    };
    if (textures && textures.building_concrete) {
      _matTank.texture    = textures.building_concrete;
      _matTank.useTexture = true;
    }
  }

  // config = { x, z, terrainY }
  function getRenderObjects(config) {
    const { x, z, terrainY = 0 } = config;
    const m4   = twgl.m4;
    const objs = [];

    const legH   = 8.0;
    const tankY  = legH;
    const spread = 1.6;

    // 4 pernas em quadrado — bases alinhadas ao terreno
    const legOffsets = [
      [ spread,  spread],
      [-spread,  spread],
      [ spread, -spread],
      [-spread, -spread],
    ];
    for (const [ox, oz] of legOffsets) {
      const legMat = m4.scale(
        m4.translate(m4.identity(), [x + ox, terrainY, z + oz]),
        [1, legH, 1]
      );
      objs.push({ bufferInfo: _legBuf, material: _matLeg, modelMat: legMat });
    }

    // Tanque cilíndrico
    const tankMat = m4.translate(m4.identity(), [x, terrainY + tankY, z]);
    objs.push({ bufferInfo: _tankBuf, material: _matTank, modelMat: tankMat });

    // Tampa cônica
    const coneMat = m4.translate(m4.identity(), [x, terrainY + tankY + 3.2, z]);
    objs.push({ bufferInfo: _coneBuf, material: _matLeg, modelMat: coneMat });

    return objs;
  }

  return { init, getRenderObjects };

})();
