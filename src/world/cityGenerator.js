// ============================================================
// src/world/cityGenerator.js — Gerador de Cidade
// Responsabilidade: posicionar prédios e árvores de forma coerente.
//
// ESTRATÉGIA DE GERAÇÃO:
//   1. Divide o mundo em uma grade de N×N células
//   2. Para cada célula, decide aleatoramente:
//      - Prédio grande (downtown)
//      - Prédio pequeno (subúrbio)
//      - Casa
//      - Área verde (sem construção)
//   3. Posiciona árvores em áreas sem construção
//
// Usa gerador de números aleatórios com SEMENTE para garantir
// que a cidade seja sempre a mesma (determinística).
// ============================================================

const CityGenerator = (() => {

  // Lista de render objects gerados (preenchida em init)
  let _buildingObjs   = [];
  let _treeObjs       = [];
  let _buildingBounds = [];
  let _lampPostObjs   = [];
  let _waterTowerObjs = [];
  let _antennaObjs    = [];
  let _wallObjs       = [];

  function init(gl, textures) {
    const rng  = MathUtils.seededRandom(42);  // Semente fixa → cidade consistente
    const C    = CONSTANTS.WORLD;
    const half = C.SIZE / 2;
    const spacing = C.SIZE / C.GRID_CELLS;

    Building.init(gl);
    Tree.init(gl, textures);
    LampPost.init(gl, textures);
    WaterTower.init(gl, textures);
    Antenna.init(gl, textures);
    UrbanWall.init(gl, textures);

    // ── Geração por grade ──────────────────────────────────────
    for (let row = 0; row < C.GRID_CELLS; row++) {
      for (let col = 0; col < C.GRID_CELLS; col++) {
        // Centro da célula na grade
        const cellX = -half + col * spacing + spacing * 0.5;
        const cellZ = -half + row * spacing + spacing * 0.5;

        // Distância do centro da cidade (para gradiente urbano)
        const dist = Math.sqrt(cellX*cellX + cellZ*cellZ);
        const maxDist = half * 0.85;

        // Células muito perto das ruas principais → sem construção
        const nearRoadX = Math.abs(cellX % spacing) < C.ROAD_WIDTH * 1.5;
        const nearRoadZ = Math.abs(cellZ % spacing) < C.ROAD_WIDTH * 1.5;
        if (nearRoadX || nearRoadZ) continue;

        const roll = rng();  // 0..1

        if (dist < maxDist * 0.3) {
          // Downtown: arranha-céus + antenas + postes
          if (roll < 0.85) _spawnBuilding(rng, cellX, cellZ, spacing, textures, 'downtown');
          if (rng() < 0.30) _spawnAntenna(rng, cellX, cellZ, spacing);
          if (rng() < 0.50) _spawnLampPost(rng, cellX, cellZ, spacing);
        } else if (dist < maxDist * 0.65) {
          // Midtown: prédios médios + antenas + caixas d'água + postes
          if (roll < 0.70) _spawnBuilding(rng, cellX, cellZ, spacing, textures, 'midtown');
          else if (roll < 0.85) _spawnTrees(rng, cellX, cellZ, spacing, 2);
          if (rng() < 0.15) _spawnAntenna(rng, cellX, cellZ, spacing);
          if (rng() < 0.25) _spawnWaterTower(rng, cellX, cellZ, spacing);
          if (rng() < 0.55) _spawnLampPost(rng, cellX, cellZ, spacing);
        } else {
          // Suburb: casas + árvores + muros + caixas d'água + postes
          if (roll < 0.40) _spawnBuilding(rng, cellX, cellZ, spacing, textures, 'suburb');
          else if (roll < 0.80) _spawnTrees(rng, cellX, cellZ, spacing, 3);
          if (rng() < 0.35) _spawnWall(rng, cellX, cellZ, spacing);
          if (rng() < 0.12) _spawnWaterTower(rng, cellX, cellZ, spacing);
          if (rng() < 0.45) _spawnLampPost(rng, cellX, cellZ, spacing);
        }
      }
    }
  }

  function _spawnBuilding(rng, cx, cz, spacing, textures, zone) {
    const pad = 2;
    const maxW = spacing - pad * 2;

    let width, depth, height, type;

    if (zone === 'downtown') {
      width  = MathUtils.randRange(rng, maxW * 0.5, maxW * 0.85);
      depth  = MathUtils.randRange(rng, maxW * 0.5, maxW * 0.85);
      height = MathUtils.randRange(rng, 25, CONSTANTS.WORLD.BUILDING_MAX_HEIGHT);
      type   = ['concrete','glass','glass'][MathUtils.randInt(rng, 0, 2)];
    } else if (zone === 'midtown') {
      width  = MathUtils.randRange(rng, maxW * 0.4, maxW * 0.7);
      depth  = MathUtils.randRange(rng, maxW * 0.4, maxW * 0.7);
      height = MathUtils.randRange(rng, 12, 30);
      type   = ['concrete','brick','glass'][MathUtils.randInt(rng, 0, 2)];
    } else {
      // suburb: casas pequenas
      width  = MathUtils.randRange(rng, maxW * 0.3, maxW * 0.55);
      depth  = MathUtils.randRange(rng, maxW * 0.3, maxW * 0.55);
      height = MathUtils.randRange(rng, CONSTANTS.WORLD.BUILDING_MIN_HEIGHT, 14);
      type   = ['brick','brick','concrete'][MathUtils.randInt(rng, 0, 2)];
    }

    // Offset do centro da célula para variedade
    const ox = MathUtils.randRange(rng, -pad, pad);
    const oz = MathUtils.randRange(rng, -pad, pad);

    // Centraliza o prédio na célula (x é canto inferior esquerdo no building)
    const x = cx + ox - width / 2;
    const z = cz + oz - depth / 2;

    if (_overlapsExisting(x, x + width, z, z + depth)) return;

    // Consulta a altura do terreno no centro do prédio
    const terrainY = HeightMap.getHeight(cx + ox, cz + oz);

    const objs = Building.getRenderObjects(
      { x, z, width, depth, height, type, terrainY },
      textures
    );

    let totalMaxY = height;

    // Considera o topo extra de cada tipo, espelhando a lógica de Building.getRenderObjects
    if (type === 'brick' && height > 15) {
      const topScale = Math.min(width, depth) * 0.8;
      totalMaxY = height + topScale * 0.5;  // altura da pirâmide
    }
    if (type === 'glass' && height > 20) {
      const covH = height * 0.08;
      totalMaxY = height + covH;            // altura da caixa de cobertura
    }

    _buildingBounds.push({
      minX: x,  maxX: x + width,
      minZ: z,  maxZ: z + depth,
      bodyHeight: height,
      terrainY:   terrainY,
      type: type,
      // dados do topo para cálculo de altura dinâmica
      topScale:   (type === 'brick' && height > 15) ? Math.min(width, depth) * 0.8 : 0,
      topOffsetX: (type === 'brick' && height > 15) ? (width  - Math.min(width, depth) * 0.8) / 2 : 0,
      topOffsetZ: (type === 'brick' && height > 15) ? (depth  - Math.min(width, depth) * 0.8) / 2 : 0,
      covH:       (type === 'glass' && height > 20) ? height * 0.08 : 0,
      covMinX:    (type === 'glass' && height > 20) ? x + width  * 0.35 : 0,
      covMaxX:    (type === 'glass' && height > 20) ? x + width  * 0.35 + width  * 0.3 : 0,
      covMinZ:    (type === 'glass' && height > 20) ? z + depth  * 0.35 : 0,
      covMaxZ:    (type === 'glass' && height > 20) ? z + depth  * 0.35 + depth  * 0.3 : 0,
    });

    _buildingObjs.push(...objs);
  }

  function _spawnTrees(rng, cx, cz, spacing, count) {
    const half = spacing * 0.4;
    for (let i = 0; i < count; i++) {
      const x = cx + MathUtils.randRange(rng, -half, half);
      const z = cz + MathUtils.randRange(rng, -half, half);
      const trunkH  = MathUtils.randRange(rng, 3, 7);
      const crownR  = MathUtils.randRange(rng, 1.8, 3.5);
      const crownH  = MathUtils.randRange(rng, 4, 8);

      if (_overlapsExisting(x - crownR, x + crownR, z - crownR, z + crownR)) continue;

      const terrainY = HeightMap.getHeight(x, z);

      const objs = Tree.getRenderObjects({ x, z, trunkHeight: trunkH, crownRadius: crownR, crownHeight: crownH, terrainY });
      _treeObjs.push(...objs);

      // Colisor da árvore: caixa quadrada com metade do lado = crownR
      _buildingBounds.push({
        minX: x - crownR, maxX: x + crownR,
        minZ: z - crownR, maxZ: z + crownR,
        bodyHeight: trunkH + crownH,
        terrainY:   terrainY,
        type: 'tree',
        topScale: 0, topOffsetX: 0, topOffsetZ: 0,
        covH: 0, covMinX: 0, covMaxX: 0, covMinZ: 0, covMaxZ: 0,
      });
    }
  }

  function _spawnLampPost(rng, cx, cz, spacing) {
    // half = spacing * 0.3 → max 15u do centro. Rua a 25u → margem segura de 10u.
    const half = spacing * 0.3;
    const x = cx + MathUtils.randRange(rng, -half, half);
    const z = cz + MathUtils.randRange(rng, -half, half);

    if (_overlapsExisting(x - 0.5, x + 0.5, z - 0.5, z + 0.5)) return;

    const terrainY = HeightMap.getHeight(x, z);
    const objs = LampPost.getRenderObjects({ x, z, terrainY });
    _lampPostObjs.push(...objs);

    // Colisor do poste: caixa pequena ao redor do fuste (raio efetivo 0.5u)
    _buildingBounds.push({
      minX: x - 0.5, maxX: x + 0.5,
      minZ: z - 0.5, maxZ: z + 0.5,
      bodyHeight: 13.0,
      terrainY:   terrainY,
      type: 'lamp',
      topScale: 0, topOffsetX: 0, topOffsetZ: 0,
      covH: 0, covMinX: 0, covMaxX: 0, covMinZ: 0, covMaxZ: 0,
    });
  }

  function _spawnWaterTower(rng, cx, cz, spacing) {
    // half = spacing * 0.22 → margem de ~13u antes da rua, pernas até ±1.6u.
    const half = spacing * 0.22;
    const x = cx + MathUtils.randRange(rng, -half, half);
    const z = cz + MathUtils.randRange(rng, -half, half);

    if (_overlapsExisting(x - 2.8, x + 2.8, z - 2.8, z + 2.8)) return;

    const terrainY = HeightMap.getHeight(x, z);
    const objs = WaterTower.getRenderObjects({ x, z, terrainY });
    _waterTowerObjs.push(...objs);

    _buildingBounds.push({
      minX: x - 2.8, maxX: x + 2.8,
      minZ: z - 2.8, maxZ: z + 2.8,
      bodyHeight: 13.3,
      terrainY:   terrainY,
      type: 'concrete',
      topScale: 0, topOffsetX: 0, topOffsetZ: 0,
      covH: 0, covMinX: 0, covMaxX: 0, covMinZ: 0, covMaxZ: 0,
    });
  }

  function _spawnAntenna(rng, cx, cz, spacing) {
    // half = spacing * 0.22 → hastes de ±1.6u ficam dentro da zona segura.
    const half = spacing * 0.22;
    const x = cx + MathUtils.randRange(rng, -half, half);
    const z = cz + MathUtils.randRange(rng, -half, half);

    if (_overlapsExisting(x - 1.0, x + 1.0, z - 1.0, z + 1.0)) return;

    const terrainY = HeightMap.getHeight(x, z);
    const objs = Antenna.getRenderObjects({ x, z, terrainY });
    _antennaObjs.push(...objs);

    _buildingBounds.push({
      minX: x - 1.0, maxX: x + 1.0,
      minZ: z - 1.0, maxZ: z + 1.0,
      bodyHeight: 26.0,
      terrainY:   terrainY,
      type: 'concrete',
      topScale: 0, topOffsetX: 0, topOffsetZ: 0,
      covH: 0, covMinX: 0, covMaxX: 0, covMinZ: 0, covMaxZ: 0,
    });
  }

  function _spawnWall(rng, cx, cz, spacing) {
    // half = spacing * 0.22 → muro de 18u (±9) fica a 25-11-9=5u da rua.
    const half   = spacing * 0.22;
    const x      = cx + MathUtils.randRange(rng, -half, half);
    const z      = cz + MathUtils.randRange(rng, -half, half);
    const length = MathUtils.randRange(rng, 8.0, 16.0);
    const useBrick = rng() < 0.5;

    if (_overlapsExisting(x - length / 2, x + length / 2, z - 0.3, z + 0.3)) return;

    const terrainY = HeightMap.getHeight(x, z);
    const objs = UrbanWall.getRenderObjects({ x, z, length, useBrick, terrainY });
    _wallObjs.push(...objs);

    // Colisor do muro: caixa que cobre o comprimento real (espessura=0.6)
    _buildingBounds.push({
      minX: x - length / 2, maxX: x + length / 2,
      minZ: z - 0.3,        maxZ: z + 0.3,
      bodyHeight: 2.5,
      terrainY:   terrainY,
      type: 'wall',
      topScale: 0, topOffsetX: 0, topOffsetZ: 0,
      covH: 0, covMinX: 0, covMaxX: 0, covMinZ: 0, covMaxZ: 0,
    });
  }

  // Retorna true se o retângulo (minX..maxX, minZ..maxZ) + padding
  // sobrepõe qualquer bound já registrado. Evita entidades sobrepostas.
  function _overlapsExisting(minX, maxX, minZ, maxZ) {
    const PAD = 1.5;
    for (const b of _buildingBounds) {
      if (minX - PAD < b.maxX && maxX + PAD > b.minX &&
          minZ - PAD < b.maxZ && maxZ + PAD > b.minZ) {
        return true;
      }
    }
    return false;
  }

  function getBuildingObjects()   { return _buildingObjs;   }
  function getTreeObjects()       { return _treeObjs;       }
  function getBuildingBounds()    { return _buildingBounds;  }
  function getLampPostObjects()   { return _lampPostObjs;   }
  function getWaterTowerObjects() { return _waterTowerObjs; }
  function getAntennaObjects()    { return _antennaObjs;    }
  function getWallObjects()       { return _wallObjs;       }

  return {
    init,
    getBuildingObjects,
    getTreeObjects,
    getBuildingBounds,
    getLampPostObjects,
    getWaterTowerObjects,
    getAntennaObjects,
    getWallObjects,
  };

})();