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
  let _buildingObjs = [];
  let _treeObjs     = [];

  function init(gl, textures) {
    const rng  = MathUtils.seededRandom(42);  // Semente fixa → cidade consistente
    const C    = CONSTANTS.WORLD;
    const half = C.SIZE / 2;
    const spacing = C.SIZE / C.GRID_CELLS;

    Building.init(gl);
    Tree.init(gl, textures);

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
          // Centro: arranha-céus
          if (roll < 0.85) _spawnBuilding(rng, cellX, cellZ, spacing, textures, 'downtown');
        } else if (dist < maxDist * 0.65) {
          // Meio: prédios médios e casas
          if (roll < 0.70) _spawnBuilding(rng, cellX, cellZ, spacing, textures, 'midtown');
          else if (roll < 0.85) _spawnTrees(rng, cellX, cellZ, spacing, 2);
        } else {
          // Periferia: casas e árvores
          if (roll < 0.40) _spawnBuilding(rng, cellX, cellZ, spacing, textures, 'suburb');
          else if (roll < 0.80) _spawnTrees(rng, cellX, cellZ, spacing, 3);
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

    const objs = Building.getRenderObjects(
      { x, z, width, depth, height, type },
      textures
    );
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

      const objs = Tree.getRenderObjects({ x, z, trunkHeight: trunkH, crownRadius: crownR, crownHeight: crownH });
      _treeObjs.push(...objs);
    }
  }

  function getBuildingObjects() { return _buildingObjs; }
  function getTreeObjects()     { return _treeObjs; }

  return { init, getBuildingObjects, getTreeObjects };

})();