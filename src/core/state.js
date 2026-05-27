// ============================================================
// src/core/state.js — Estado Global da Aplicação
// Responsabilidade: single source of truth.
// Todos os sistemas leem/escrevem aqui — comunicação desacoplada.
//
// PADRÃO: em vez de passar referências entre módulos,
// cada sistema acessa State diretamente. Isso evita dependências
// circulares e facilita depuração (um lugar para inspecionar tudo).
// ============================================================

const State = (() => {

  // Estado interno (privado) — só modificável via métodos
  const _state = {

    // ── Aeronave ───────────────────────────────────────────────
    aircraft: {
      position:    [0, 20, 0],    // Posição no mundo (x, y, z)
      rotation:    0,              // Rotação no eixo Y (yaw), em radianos
      tiltX:       0,              // Inclinação cosmética frente/trás
      tiltZ:       0,              // Inclinação cosmética esquerda/direita
      rotorAngle:  0,              // Ângulo atual das hélices (acumulado)
      velocity:    [0, 0, 0],      // Velocidade atual (para suavização futura)
    },

    // ── Câmera ────────────────────────────────────────────────
    camera: {
      mode: 'top',                 // 'top' | 'cinematic'
      cinematicAngle: 'back',      // 'front' | 'back' | 'left' | 'right'
      // Posição e alvo atuais (com lerp aplicado — suaves)
      position:   [0, 120, 0],
      target:     [0, 0, 0],
      up:         [0, 1, 0],
      // Posição e alvo destino (sem lerp — onde a câmera QUER estar)
      targetPosition: [0, 120, 0],
      targetLookAt:   [0, 0, 0],
    },

    // ── Iluminação ────────────────────────────────────────────
    lighting: {
      enabled: true,
      sunAngle: 0,                 // Ângulo do sol (para animação futura)
    },

    // ── Input ─────────────────────────────────────────────────
    // Mapa de teclas pressionadas: { 'KeyW': true, ... }
    // Usar mapa (vs flags individuais) permite detecção de múltiplas teclas
    input: {
      keys: {},
    },

    // ── Jogo ──────────────────────────────────────────────────
    game: {
      running: false,
      paused: false,
      totalTime: 0,               // Tempo total acumulado (segundos)
    },

    render: {
      fogEnabled: false,   // false = desligado por padrão; N para ligar
    },

    // ── Audio ─────────────────────────────────────────────────
    audio: {
      muted: false,
      volume: 0.4,
    },

    // ── UI ────────────────────────────────────────────────────
    ui: {
      fps: 0,
    },
  };

  // ── API pública ───────────────────────────────────────────────

  // Acesso direto ao objeto de estado (leitura e escrita permitidas)
  // Em projetos maiores, usar getters/setters ou imutabilidade (Immer)
  function get() {
    return _state;
  }

  // Verificação se uma tecla está pressionada
  function isKeyDown(code) {
    return !!_state.input.keys[code];
  }

  // Reset do estado da aeronave (útil para restart)
  function resetAircraft() {
    _state.aircraft.position    = [0, 20, 0];
    _state.aircraft.rotation    = 0;
    _state.aircraft.tiltX       = 0;
    _state.aircraft.tiltZ       = 0;
    _state.aircraft.rotorAngle  = 0;
    _state.aircraft.velocity    = [0, 0, 0];
  }

  return { get, isKeyDown, resetAircraft };

})();