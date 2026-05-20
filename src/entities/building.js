// ============================================================
// src/entities/building.js — Prédios e Casas
// Responsabilidade: geometria e renderização de construções.
//
// Cada prédio é composto por:
//   - Corpo (caixa parametrizável: largura, profundidade, altura)
//   - Topo (variações: plano, pirâmide, caixa de cobertura)
//
// Os prédios são gerados proceduralmente pelo CityGenerator
// e armazenam apenas sua matrix de modelo + material.
// A geometria é compartilhada (instâncias do mesmo buffer).
//
// INSTANCING MANUAL:
//   Em vez de instancing WebGL (mais complexo), reutilizamos
//   o mesmo bufferInfo e mudamos apenas a matrix model.
//   Custo: um draw call por prédio. Aceitável para ~80 prédios.
// ============================================================

const Building = (() => {

  // Buffer compartilhado: caixa unitária (1×1×1 com pé em Y=0)
  let _boxBuf      = null;
  let _pyramidBuf  = null;

  // ── Caixa unitária ────────────────────────────────────────────
  // Vértices de um cubo de lado 1, com base em Y=0 e topo em Y=1.
  // Será escalado pela matrix model para o tamanho de cada prédio.
  function _buildUnitBox(gl) {
    // 6 faces × 2 triângulos × 3 vértices = 36 vértices
    // Normais distintas por face (não compartilhadas) para iluminação flat correta
    const positions = [];
    const normals   = [];
    const texcoords = [];

    function face(verts, normal, uvs) {
      // Dois triângulos por face (quad → 2 tris)
      const tris = [[0,1,2], [0,2,3]];
      for (const t of tris) {
        for (const i of t) {
          positions.push(...verts[i]);
          normals.push(...normal);
          texcoords.push(...uvs[i]);
        }
      }
    }

    // Z+ (frente)
    face([[0,0,1],[1,0,1],[1,1,1],[0,1,1]], [0,0,1],  [[0,0],[1,0],[1,1],[0,1]]);
    // Z- (trás)
    face([[1,0,0],[0,0,0],[0,1,0],[1,1,0]], [0,0,-1], [[0,0],[1,0],[1,1],[0,1]]);
    // X+ (direita)
    face([[1,0,1],[1,0,0],[1,1,0],[1,1,1]], [1,0,0],  [[0,0],[1,0],[1,1],[0,1]]);
    // X- (esquerda)
    face([[0,0,0],[0,0,1],[0,1,1],[0,1,0]], [-1,0,0], [[0,0],[1,0],[1,1],[0,1]]);
    // Y+ (topo)
    face([[0,1,1],[1,1,1],[1,1,0],[0,1,0]], [0,1,0],  [[0,0],[1,0],[1,1],[0,1]]);
    // Y- (base) — não visível, mas incluída para completude
    face([[0,0,0],[1,0,0],[1,0,1],[0,0,1]], [0,-1,0], [[0,0],[1,0],[1,1],[0,1]]);

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  // ── Pirâmide (topo decorativo) ────────────────────────────────
  function _buildPyramid(gl) {
    const positions = [], normals = [], texcoords = [];

    // 4 faces triangulares
    const apex  = [0.5, 1, 0.5];
    const base  = [[0,0,0],[1,0,0],[1,0,1],[0,0,1]];

    for (let i = 0; i < 4; i++) {
      const b0 = base[i];
      const b1 = base[(i+1)%4];

      // Normal da face via produto vetorial
      const e1 = [b1[0]-b0[0], b1[1]-b0[1], b1[2]-b0[2]];
      const e2 = [apex[0]-b0[0], apex[1]-b0[1], apex[2]-b0[2]];
      const n  = MathUtils.crossVec3([0,0,0], e1, e2);
      MathUtils.normalizeVec3(n, n);

      positions.push(...b0, ...b1, ...apex);
      normals.push(...n, ...n, ...n);
      texcoords.push(0,0, 1,0, 0.5,1);
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal:   { numComponents: 3, data: new Float32Array(normals) },
      a_texcoord: { numComponents: 2, data: new Float32Array(texcoords) },
    });
  }

  function init(gl) {
    _boxBuf     = _buildUnitBox(gl);
    _pyramidBuf = _buildPyramid(gl);
  }

  // ── Gera render objects de um prédio ──────────────────────────
  // config = { x, z, width, depth, height, type, textureKey }
  function getRenderObjects(config, textures, texturePool) {
    const { x, z, width, depth, height, type } = config;
    const objs = [];
    const m4   = twgl.m4;

    // Material e textura baseados no tipo
    const matPresets = {
      'concrete': Material.PRESETS.concrete,
      'glass':    Material.PRESETS.glass,
      'brick':    Material.PRESETS.brick,
    };
    const texKeys = {
      'concrete': 'building_concrete',
      'glass':    'building_glass',
      'brick':    'building_brick',
    };

    const baseMat = { ...matPresets[type] };
    const tex = textures[texKeys[type]];
    if (tex) {
      baseMat.texture    = tex;
      baseMat.useTexture = true;
    }

    // ── Corpo do prédio (caixa escalada) ──────────────────────
    // A caixa unitária é escalada para [width, height, depth]
    // e transladada para (x, 0, z)
    const bodyMat = m4.scale(
      m4.translate(m4.identity(), [x, 0, z]),
      [width, height, depth]
    );
    objs.push({ bufferInfo: _boxBuf, material: baseMat, modelMat: bodyMat });

    // ── Topo variado ──────────────────────────────────────────
    if (type === 'brick' && height > 15) {
      // Pirâmide decorativa para prédios de tijolo altos
      const topScale  = Math.min(width, depth) * 0.8;
      const topOffset = [(width - topScale) / 2, 0, (depth - topScale) / 2];
      const topMat = m4.scale(
        m4.translate(m4.identity(), [x + topOffset[0], height, z + topOffset[2]]),
        [topScale, topScale * 0.5, topScale]
      );
      objs.push({ bufferInfo: _pyramidBuf, material: baseMat, modelMat: topMat });
    }

    if (type === 'glass' && height > 20) {
      // Caixa de cobertura (casa de máquinas)
      const covW = width * 0.3, covD = depth * 0.3, covH = height * 0.08;
      const covMat = m4.scale(
        m4.translate(m4.identity(), [x + width*0.35, height, z + depth*0.35]),
        [covW, covH, covD]
      );
      const concMat = { ...Material.PRESETS.concrete };
      objs.push({ bufferInfo: _boxBuf, material: concMat, modelMat: covMat });
    }

    return objs;
  }

  return { init, getRenderObjects };

})();