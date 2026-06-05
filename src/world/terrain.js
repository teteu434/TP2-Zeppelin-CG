// ============================================================
// src/world/terrain.js — Terreno com Height Map
// ============================================================
const Terrain = (() => {
  let _groundBuf = null;
  let _roadBuf   = null;
  let _matGround = null;
  let _matRoad   = null;

  // ── Malha subdividida com deslocamento vertical (height map) ──
  // Substitui o quad simples (2 triângulos, 4 vértices) por uma grade
  // de segsX × segsZ células, onde cada vértice é deslocado em Y
  // conforme o HeightMap.
  //
  // Por que subdivisões são obrigatórias:
  //   Um quad tem apenas 4 vértices — o deslocamento Y só pode ser
  //   aplicado nos cantos. Uma grade de 100×100 permite amostrar
  //   o height map a cada 6 unidades (600/100), capturando colinas
  //   e ondulações com fidelidade suficiente.
  //
  // Contagem de vértices e índices (100×100):
  //   Vértices: 101 × 101 = 10.201   (< 65.535 → Uint16Array ✓)
  //   Triângulos: 100 × 100 × 2 = 20.000
  //   Índices:  60.000 valores
  //
  // Normais calculadas via gradiente do campo de altura:
  //   Para y = f(x,z), o vetor normal é:
  //     N = normalize(-∂f/∂x,  1,  -∂f/∂z)
  //   Aproximado por diferenças finitas centradas nos vizinhos.
  function _buildSubdividedPlane(gl, width, depth, segsX, segsZ, uvRepeat) {
    const hw = width / 2;
    const hd = depth / 2;
    const nx = segsX + 1;   // número de vértices por linha (eixo X)
    const nz = segsZ + 1;   // número de vértices por coluna (eixo Z)

    // ── Pré-computar alturas ──────────────────────────────────
    // Armazenadas em array linear: heights[iz * nx + ix]
    // Necessário antes de calcular normais (que dependem dos vizinhos).
    const heights = new Float32Array(nx * nz);
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const wx = -hw + (ix / segsX) * width;
        const wz = -hd + (iz / segsZ) * depth;
        heights[iz * nx + ix] = HeightMap.getHeight(wx, wz);
      }
    }

    // ── Atributos de vértice ──────────────────────────────────
    const positions = new Float32Array(nx * nz * 3);
    const normals   = new Float32Array(nx * nz * 3);
    const texcoords = new Float32Array(nx * nz * 2);

    // Tamanho de cada célula em unidades (para cálculo de gradiente)
    const cellW = width / segsX;
    const cellD = depth / segsZ;

    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const vi   = iz * nx + ix;
        const pBase = vi * 3;

        const wx = -hw + (ix / segsX) * width;
        const wz = -hd + (iz / segsZ) * depth;
        const wy = heights[vi];

        // Posição no espaço de mundo
        positions[pBase]     = wx;
        positions[pBase + 1] = wy;
        positions[pBase + 2] = wz;

        // UV: repete a textura uvRepeat vezes sobre toda a grade
        texcoords[vi * 2]     = (ix / segsX) * uvRepeat;
        texcoords[vi * 2 + 1] = (iz / segsZ) * uvRepeat;

        // Normal via gradiente central do campo de altura:
        //   ∂f/∂x ≈ (h[ix+1] - h[ix-1]) / (2 * cellW)
        //   ∂f/∂z ≈ (h[iz+1] - h[iz-1]) / (2 * cellD)
        //   N = normalize(-fx, 1, -fz)  → aponta para cima (+Y)
        const ixL = Math.max(0, ix - 1);
        const ixR = Math.min(segsX, ix + 1);
        const izD = Math.max(0, iz - 1);
        const izU = Math.min(segsZ, iz + 1);

        const hL = heights[iz  * nx + ixL];
        const hR = heights[iz  * nx + ixR];
        const hD = heights[izD * nx + ix ];
        const hU = heights[izU * nx + ix ];

        const fx = (hR - hL) / ((ixR - ixL) * cellW);
        const fz = (hU - hD) / ((izU - izD) * cellD);

        const nnx = -fx;
        const nny = 1.0;
        const nnz = -fz;
        const len = Math.sqrt(nnx * nnx + nny * nny + nnz * nnz);
        normals[pBase]     = nnx / len;
        normals[pBase + 1] = nny / len;
        normals[pBase + 2] = nnz / len;
      }
    }

    // ── Índices (winding CCW visto de cima → normal = +Y) ─────
    // Para cada quad (ix, iz):
    //   a = iz * nx + ix       (inferior-esquerdo)
    //   b = a  + 1             (inferior-direito)
    //   c = a  + nx            (superior-esquerdo)
    //   d = c  + 1             (superior-direito)
    //
    //   Tri 1: a, c, b  (CCW)
    //   Tri 2: b, c, d  (CCW)
    const indices = new Uint16Array(segsX * segsZ * 6);
    let idx = 0;
    for (let iz = 0; iz < segsZ; iz++) {
      for (let ix = 0; ix < segsX; ix++) {
        const a = iz * nx + ix;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        indices[idx++] = a; indices[idx++] = c; indices[idx++] = b;
        indices[idx++] = b; indices[idx++] = c; indices[idx++] = d;
      }
    }

    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: positions },
      a_normal:   { numComponents: 3, data: normals   },
      a_texcoord: { numComponents: 2, data: texcoords },
      indices:    { numComponents: 3, data: indices   },
    });
  }

  function _buildRoadSegment(gl, length, width) {
    const hl = length / 2, hw = width / 2;

    // Mesmo problema: winding CW → normal aponta para baixo → culled.
    // Correção idêntica: trocar B↔C em cada triângulo.

    const positions = new Float32Array([
      // Triângulo 1 — Y=0.15 garante separação do chão além da precisão do depth buffer
      -hw, 0.15, -hl,    hw, 0.15,  hl,    hw, 0.15, -hl,
      // Triângulo 2
      -hw, 0.15, -hl,   -hw, 0.15,  hl,    hw, 0.15,  hl,
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
    // 100×100 segmentos: 10.201 vértices, qualidade visual adequada para cidade.
    // uvRepeat = S/8 mantém o mesmo padrão de tiling da grama anterior.
    _groundBuf = _buildSubdividedPlane(gl, S, S, 100, 100, S / 8);
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
      bufferInfo:  _groundBuf,
      material:    _matGround,
      modelMat:    m4.identity(),
      heightTint:  true,
    });

    const cells   = CONSTANTS.WORLD.GRID_CELLS;
    const spacing = S / cells;
    const half    = S / 2;

    for (let i = 0; i <= cells; i++) {
      const pos = -half + i * spacing;

      // Ruas N-S (correm ao longo de Z) — polygonOffset empurra para frente da câmera
      // no depth buffer, eliminando z-fighting com o chão a qualquer distância.
      objs.push({
        bufferInfo:    _roadBuf,
        material:      _matRoad,
        modelMat:      m4.translate(m4.identity(), [pos, 0, 0]),
        polygonOffset: true,
      });

      // Ruas E-W (rotacionadas 90°) — Y extra de 0.10 no model matrix previne
      // z-fighting nos cruzamentos (dois quads coplanares).
      objs.push({
        bufferInfo:    _roadBuf,
        material:      _matRoad,
        modelMat:      m4.rotateY(m4.translate(m4.identity(), [0, 0.10, pos]), Math.PI / 2),
        polygonOffset: true,
      });
    }

    return objs;
  }

  return { init, getRenderObjects };
})();