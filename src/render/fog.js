// ============================================================
// src/render/fog.js — Sistema de Neblina
// Responsabilidade: armazenar parâmetros e gerar uniforms de fog.
//
// FOG LINEAR:
//   fogFactor = clamp((fogFar - d) / (fogFar - fogNear), 0.0, 1.0)
//   finalColor = mix(fogColor, objectColor, fogFactor)
//
//   d = distância euclidiana fragmento → câmera
//   fogFactor = 1.0 → objeto totalmente visível (perto)
//   fogFactor = 0.0 → objeto totalmente encoberto (longe)
//
// CALIBRAÇÃO:
//   Neblina leve:        fogNear=200, fogFar=800
//   Neblina densa:       fogNear=50,  fogFar=300
//   Efeito cinematográfico: fogNear=100, fogFar=500, cor azulada
//   Cidade infinita:     fogNear=300, fogFar=900, cor do céu
// ============================================================

const Fog = (() => {

  // ── Parâmetros ajustáveis ─────────────────────────────────
  // Edite estes valores para calibrar o efeito visual.
  //
  // fogNear: distância a partir da qual a neblina COMEÇA (objetos ainda visíveis)
  // fogFar:  distância a partir da qual a neblina está COMPLETA (objetos somem)
  // fogColor: cor da neblina — deve combinar com o horizonte do skybox
  //           SKY_BOTTOM do projeto é [0.45, 0.65, 0.90] → usamos valor próximo
  const _params = {
    fogNear:  60.0,   
    fogFar:   320.0,  
    fogColor: [0.50, 0.68, 0.92, 1.0], // RGBA — combina com SKY_BOTTOM
  };

  // ── Gera o objeto de uniforms para o shader ───────────────
  // Chamado a cada frame pelo Renderer antes de cada draw call.
  function toUniforms() {
    const enabled = State.get().render.fogEnabled;
    return {
      u_fogEnabled: enabled,
      u_fogNear:    _params.fogNear,
      u_fogFar:     _params.fogFar,
      u_fogColor:   _params.fogColor,
    };
  }

  // ── Toggle — chamado pelo Input na tecla N ────────────────
  function toggle() {
    const state = State.get().render;
    state.fogEnabled = !state.fogEnabled;
    console.log('[Fog] Neblina:', state.fogEnabled ? 'ON' : 'OFF');
  }

  // ── Getters para HUD (opcional) ───────────────────────────
  function isEnabled() {
    return State.get().render.fogEnabled;
  }

  return { toUniforms, toggle, isEnabled };

})();