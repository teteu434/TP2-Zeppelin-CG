// ============================================================
// src/render/lighting.js — Sistema de Iluminação
// Responsabilidade: gerenciar e fornecer uniforms de luz.
//
// MODELO DE PHONG (implementação no fragment shader):
//
//   Iluminação = Ambiente + Difusa + Especular
//
//   Ambiente:  simula luz indireta e reflexos difusos do ambiente
//              → constante, não depende de ângulos
//
//   Difusa:    luz direta, depende do ângulo entre normal e luz
//              → Lambert: I = max(dot(N, L), 0)
//              → 0 quando perpendicular, 1 quando paralelo à normal
//
//   Especular: brilho direcional, depende do ângulo de visão
//              → Phong: I = max(dot(R, V), 0)^shininess
//              → R = reflect(-L, N)
// ============================================================

const Lighting = (() => {

  // Estado interno da iluminação
  const _light = {
    direction: [...CONSTANTS.LIGHTING.DIRECTION],
    color:     [...CONSTANTS.LIGHTING.COLOR],
    ambient:   [...CONSTANTS.LIGHTING.AMBIENT],
    specular:  [...CONSTANTS.LIGHTING.SPECULAR_COLOR],
  };

  // Atualiza a iluminação a cada frame (para animação do sol, se desejado)
  function update(totalTime) {
    // Por ora, luz estática.
    // Extensão futura: animar o sol ao longo do dia:
    // _light.direction[0] = Math.cos(totalTime * 0.05);
    // _light.direction[1] = -Math.abs(Math.sin(totalTime * 0.05)) - 0.2;
  }

  // Gera o objeto de uniforms de iluminação para o shader
  // cameraPos: posição da câmera para cálculo especular (vec3)
  function toUniforms(cameraPos) {
    const enabled = State.get().lighting.enabled;
    return {
      u_lightDir:        _light.direction,
      u_lightColor:      _light.color,
      u_ambientColor:    enabled ? _light.ambient : [0.8, 0.8, 0.8],
      u_lightingEnabled: enabled,
      u_cameraPos:       cameraPos,
    };
  }

  return { update, toUniforms };

})();