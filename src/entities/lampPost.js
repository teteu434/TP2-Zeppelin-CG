// ============================================================
// src/entities/lampPost.js — Postes de Luz
// Geometria: fuste cilíndrico + braço horizontal + luminária esférica
// ============================================================

const LampPost = (() => {

  let _shaftBuf  = null;
  let _armBuf    = null;
  let _lampBuf   = null;
  let _matMetal  = null;
  let _matLamp   = null;

  function _buildCylinder(gl, radius, height, segs) {
    const positions = [], normals = [], texcoords = [];

    for (let i = 0; i < segs; i++) {
      const a0 = (i     / segs) * Math.PI * 2;
      const a1 = ((i+1) / segs) * Math.PI * 2;
      const x0 = Math.cos(a0) * radius, z0 = Math.sin(a0) * radius;
      const x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;

      positions.push(x0,0,z0, x1,0,z1, x1,height,z1);
      positions.push(x0,0,z0, x1,height,z1, x0,height,z0);
      const nx0 = x0/radius, nz0 = z0/radius;
      const nx1 = x1/radius, nz1 = z1/radius;
      normals.push(nx0,0,nz0, nx1,0,nz1, nx1,0,nz1);
      normals.push(nx0,0,nz0, nx1,0,nz1, nx0,0,nz0);
      texcoords.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);

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

  function _buildSphere(gl, rx, ry, rz, latSegs, lonSegs) {
    const positions = [], normals = [], texcoords = [];

    for (let lat = 0; lat < latSegs; lat++) {
      const theta0 = (lat     / latSegs) * Math.PI;
      const theta1 = ((lat+1) / latSegs) * Math.PI;

      for (let lon = 0; lon < lonSegs; lon++) {
        const phi0 = (lon     / lonSegs) * Math.PI * 2;
        const phi1 = ((lon+1) / lonSegs) * Math.PI * 2;

        const p = (th, ph) => [
          rx * Math.sin(th) * Math.cos(ph),
          ry * Math.cos(th),
          rz * Math.sin(th) * Math.sin(ph),
        ];
        const n = (th, ph) => {
          const v = [Math.sin(th)*Math.cos(ph), Math.cos(th), Math.sin(th)*Math.sin(ph)];
          const len = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]) || 1;
          return [v[0]/len, v[1]/len, v[2]/len];
        };

        const v00=p(theta0,phi0), v10=p(theta1,phi0), v01=p(theta0,phi1), v11=p(theta1,phi1);
        const n00=n(theta0,phi0), n10=n(theta1,phi0), n01=n(theta0,phi1), n11=n(theta1,phi1);

        positions.push(...v00,...v10,...v11, ...v00,...v11,...v01);
        normals.push(...n00,...n10,...n11, ...n00,...n11,...n01);
        texcoords.push(0,0,1,0,1,1, 0,0,1,1,0,1);
      }
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  function init(gl, textures) {
    _shaftBuf = _buildCylinder(gl, 0.18, 1.0, 8);
    _armBuf   = _buildUnitBox(gl);
    _lampBuf  = _buildSphere(gl, 0.55, 0.40, 0.55, 7, 10);

    _matMetal = { ...Material.PRESETS.metalDark };
    _matLamp  = {
      diffuse:    [1.0, 0.95, 0.6],
      ambient:    [0.9, 0.85, 0.4],
      specular:   [1.0, 1.0, 0.8],
      shininess:  32,
      alpha:      1.0,
      texture:    null,
      useTexture: false,
    };
  }

  // config = { x, z }
  function getRenderObjects(config) {
    const { x, z } = config;
    const m4   = twgl.m4;
    const objs = [];

    const shaftH   = 12.0;
    const armLen   = 2.2;
    const armThick = 0.25;

    // Fuste: cilindro escalonado para altura 12
    const shaftMat = m4.scale(
      m4.translate(m4.identity(), [x, 0, z]),
      [1, shaftH, 1]
    );
    objs.push({ bufferInfo: _shaftBuf, material: _matMetal, modelMat: shaftMat });

    // Braço horizontal: caixa fina saindo do topo
    const armMat = m4.scale(
      m4.translate(m4.identity(), [x, shaftH - armThick * 0.5, z - armThick * 0.5]),
      [armLen, armThick, armThick]
    );
    objs.push({ bufferInfo: _armBuf, material: _matMetal, modelMat: armMat });

    // Luminária: esfera na ponta do braço
    const lampMat = m4.translate(m4.identity(), [x + armLen, shaftH + 0.1, z]);
    objs.push({ bufferInfo: _lampBuf, material: _matLamp, modelMat: lampMat });

    return objs;
  }

  return { init, getRenderObjects };

})();
