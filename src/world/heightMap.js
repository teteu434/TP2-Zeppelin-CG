// ============================================================
// src/world/heightMap.js — Gerador de Height Map Procedural
// Responsabilidade: calcular a altura do terreno em qualquer
// ponto (worldX, worldZ) do mundo, sem depender de imagens.
//
// TÉCNICA: Fractional Brownian Motion com ondas senoidais
//   Soma de senos em 4 oitavas com amplitudes decrescentes (1/2, 1/4, 1/8, 1/16).
//   Produz ondulações suaves e naturais: colinas largas dominadas
//   pelas oitavas baixas, com detalhes finos nas oitavas altas.
//
// MÁSCARA DE RUAS:
//   As ruas do grid permanecem planas (y = 0). Uma zona de transição
//   suave (smoothstep) interpola entre o terreno elevado e o plano
//   da rua, evitando cortes bruscos.
//
// API pública:
//   HeightMap.getHeight(worldX, worldZ) → float  (altura em unidades)
// ============================================================

const HeightMap = (() => {

  // ── Parâmetros configuráveis ──────────────────────────────────
  // MAX_TERRAIN_HEIGHT: amplitude máxima das colinas (em unidades de mundo).
  //   10 unidades → colinas suaves, visualmente proporcionais à cidade.
  //   Aumentar para 20+ cria morros mais pronunciados.
  const MAX_TERRAIN_HEIGHT = 10.0;

  // BLEND_ZONE: distância (em unidades) além da borda da rua onde o terreno
  //   transiciona de plano (0) para elevado. Valor maior = transição mais suave.
  const BLEND_ZONE = 14.0;

  // ── Interpolação suave de Hermite ─────────────────────────────
  // smoothstep(0, edge1, x) = 3t² - 2t³  onde  t = x / edge1
  // Produz transição sem arestas (derivada = 0 nas extremidades).
  // Usado na máscara de rua para evitar cortes abruptos no terreno.
  function _smoothstep(edge0, edge1, x) {
    const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3.0 - 2.0 * t);
  }

  // ── Ruído procedural: soma de senos (fBm) ────────────────────
  // 4 oitavas com frequências e fases distintas.
  //
  // Conversão de frequência → período:
  //   período = 2π / frequência
  //   0.01257 → período ≈ 500 unidades (colina muito longa)
  //   0.02513 → período ≈ 250 unidades (colina média)
  //   0.05236 → período ≈ 120 unidades (ondulação pequena)
  //   0.10472 → período ≈  60 unidades (detalhe fino)
  //
  // O produto sin(x) * sin(z) cria um padrão 2D natural, diferente
  // de simplesmente somar sin em X e sin em Z separadamente.
  //
  // Retorno: valor em [0, 1]
  function _sineNoise(wx, wz) {
    let h = 0.0;
    // Oitava 1 — colinas largas, amplitude 0.5
    h += Math.sin(wx * 0.01257 + 0.50) * Math.sin(wz * 0.01100 + 0.30) * 0.5000;
    // Oitava 2 — ondulações médias, amplitude 0.25
    h += Math.sin(wx * 0.02513 + 1.30) * Math.sin(wz * 0.02200 + 0.90) * 0.2500;
    // Oitava 3 — detalhes pequenos, amplitude 0.125
    h += Math.sin(wx * 0.05236 + 2.10) * Math.sin(wz * 0.04400 + 1.70) * 0.1250;
    // Oitava 4 — microdetalhes, amplitude 0.0625
    h += Math.sin(wx * 0.10472 + 0.80) * Math.sin(wz * 0.08800 + 2.40) * 0.0625;

    // Intervalo teórico: ±(0.5 + 0.25 + 0.125 + 0.0625) = ±0.9375
    // Normaliza para [0, 1]:  h_normalizado = (h + 0.9375) / 1.875
    return (h + 0.9375) / 1.875;
  }

  // ── Máscara de ruas ───────────────────────────────────────────
  // Retorna 0.0 sobre ou perto da rua → terreno plano.
  //          1.0 longe da rua         → terreno com elevação total.
  //
  // As ruas N-S ficam em x = -half + i * spacing  (i = 0..GRID_CELLS)
  // As ruas E-W ficam em z = -half + i * spacing
  //
  // Para cada ponto (wx, wz), calculamos:
  //   minDX = distância até a rua N-S mais próxima
  //   minDZ = distância até a rua E-W mais próxima
  //
  // O mask é o MÍNIMO dos dois: próximo de qualquer rua → suprime altura.
  function _roadMask(wx, wz) {
    const S       = CONSTANTS.WORLD.SIZE;         // 600
    const cells   = CONSTANTS.WORLD.GRID_CELLS;   // 12
    const spacing = S / cells;                    // 50
    const half    = S / 2;                        // 300
    const rHalf   = CONSTANTS.WORLD.ROAD_WIDTH / 2; // 4

    // Distância da rua N-S mais próxima (função de wx)
    let minDX = Infinity;
    for (let i = 0; i <= cells; i++) {
      minDX = Math.min(minDX, Math.abs(wx - (-half + i * spacing)));
    }

    // Distância da rua E-W mais próxima (função de wz)
    let minDZ = Infinity;
    for (let i = 0; i <= cells; i++) {
      minDZ = Math.min(minDZ, Math.abs(wz - (-half + i * spacing)));
    }

    // Transição suave:
    //   < rHalf          → 0.0 (sobre a rua)
    //   rHalf..rHalf+BZ  → smoothstep (zona de blend)
    //   > rHalf+BZ       → 1.0 (longe da rua)
    const maskX = minDX < rHalf ? 0.0
                : minDX > rHalf + BLEND_ZONE ? 1.0
                : _smoothstep(0.0, BLEND_ZONE, minDX - rHalf);

    const maskZ = minDZ < rHalf ? 0.0
                : minDZ > rHalf + BLEND_ZONE ? 1.0
                : _smoothstep(0.0, BLEND_ZONE, minDZ - rHalf);

    return Math.min(maskX, maskZ);
  }

  // ── API pública ───────────────────────────────────────────────
  // Combina ruído e máscara para produzir a altura final.
  //
  // height = noiseNormalizado * roadMask * MAX_TERRAIN_HEIGHT
  //
  // Exemplos de retorno (MAX_TERRAIN_HEIGHT = 10):
  //   Ponto sobre rua           → 0.0
  //   Ponto em campo aberto     → 0.0 .. 10.0
  //   Ponto no topo de colina   → ~10.0
  //
  // A função é contínua e diferenciável em todo o domínio,
  // garantindo transições suaves sem artefatos visuais.
  function getHeight(worldX, worldZ) {
    const noise = _sineNoise(worldX, worldZ); // [0, 1]
    const mask  = _roadMask(worldX, worldZ);  // [0, 1]
    return noise * mask * MAX_TERRAIN_HEIGHT;
  }

  return { getHeight };

})();
