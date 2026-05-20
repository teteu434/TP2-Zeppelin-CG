const CONSTANTS = Object.freeze({
 
  // ── Câmera ──────────────────────────────────────────────────
  CAMERA: {
    FOV_DEG: 60,              // Campo de visão em graus (Field of View)
    NEAR: 0.1,                // Plano de corte próximo — objetos mais perto não renderizam
    FAR: 2000,                // Plano de corte distante — objetos mais longe não renderizam
    TOP_HEIGHT: 120,          // Altura da câmera superior sobre o objeto
    TOP_DISTANCE: 0,          // Câmera superior fica exatamente acima
    CINEMATIC_HEIGHT: 18,     // Altura relativa da câmera cinemática
    CINEMATIC_DISTANCE: 28,   // Distância radial da câmera cinemática
    LERP_SPEED: 0.08,         // Suavização (lerp) do movimento de câmera [0..1]
  },
 
  // ── Aeronave ─────────────────────────────────────────────────
  AIRCRAFT: {
    SPEED: 25,                // Unidades por segundo (frente/trás)
    TURN_SPEED: 1.8,          // Radianos por segundo (rotação Y)
    VERTICAL_SPEED: 15,       // Unidades por segundo (subir/descer)
    MIN_HEIGHT: 5,            // Altura mínima sobre o chão
    MAX_HEIGHT: 200,          // Teto máximo
    ROTOR_SPEED: 6.0,         // Radianos por segundo — rotação da hélice
    TILT_FACTOR: 0.25,        // Inclinação visual ao mover (cosmético)
    TILT_RECOVERY: 3.0,       // Velocidade de recuperação da inclinação
  },
 
  // ── Mundo ───────────────────────────────────────────────────
  WORLD: {
    SIZE: 600,                // Tamanho do mundo (600x600 unidades)
    GRID_CELLS: 12,           // Grade de distribuição de prédios
    BUILDING_MIN_HEIGHT: 8,
    BUILDING_MAX_HEIGHT: 60,
    BUILDING_COUNT: 80,
    TREE_COUNT: 60,
    ROAD_WIDTH: 8,
  },
 
  // ── Iluminação ───────────────────────────────────────────────
  LIGHTING: {
    DIRECTION: [0.4, -0.8, 0.3],       // Direção da luz (não normalizada — shader normaliza)
    COLOR: [1.0, 0.95, 0.85],          // Cor da luz (branco levemente quente)
    AMBIENT: [0.18, 0.20, 0.25],       // Luz ambiente (azulada — simula céu)
    SPECULAR_COLOR: [1.0, 1.0, 0.9],   // Cor especular
  },
 
  // ── Cores / Materiais base ───────────────────────────────────
  COLORS: {
    SKY_TOP:    [0.10, 0.15, 0.35, 1.0],    // Azul escuro — topo do gradiente
    SKY_BOTTOM: [0.45, 0.65, 0.90, 1.0],    // Azul claro — horizonte
    GROUND:     [0.25, 0.32, 0.18],          // Verde escuro
    ROAD:       [0.20, 0.20, 0.22],          // Asfalto
    BUILDING_A: [0.60, 0.62, 0.65],          // Concreto claro
    BUILDING_B: [0.35, 0.38, 0.45],          // Concreto escuro (vidro)
    BUILDING_C: [0.75, 0.55, 0.35],          // Tijolo
    TREE_TRUNK: [0.40, 0.26, 0.13],
    TREE_LEAVES:[0.18, 0.55, 0.22],
    AIRCRAFT_BODY: [0.85, 0.88, 0.92],       // Metal claro
    AIRCRAFT_CAB:  [0.20, 0.55, 0.80],       // Vidro azul
    AIRCRAFT_ROTOR:[0.15, 0.15, 0.18],       // Metal escuro
  },
 
  // ── Performance ──────────────────────────────────────────────
  PERF: {
    MAX_DELTA: 0.1,           // Cap do deltaTime (evita saltos com tab inativo)
    FPS_SAMPLE_SIZE: 60,      // Amostras para cálculo de FPS médio
  },
 
});