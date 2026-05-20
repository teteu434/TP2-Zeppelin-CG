// ============================================================
// src/systems/movementSystem.js — Movimento da Aeronave
// Responsabilidade: ler input e atualizar posição/rotação da aeronave.
//
// SISTEMA DE COORDENADAS:
//   X: direita
//   Y: cima
//   Z: "para fora da tela" (eixo -Z é "para dentro")
//
// MOVIMENTO RELATIVO À ROTAÇÃO:
//   O avião se move na direção em que está apontando.
//   Rotação = ângulo no eixo Y (yaw).
//   frente = [-sin(rotation), 0, -cos(rotation)]
//   (negativo Z porque WebGL é "right-handed", -Z = frente)
//
// INCLINAÇÃO COSMÉTICA (tilt):
//   Ao mover, o avião inclina visualmente para dar sensação de inércia.
//   Não afeta a hitbox/lógica, apenas a matriz de modelo.
// ============================================================

const MovementSystem = (() => {

  function update(dt) {
    const keys = State.get().input.keys;
    const ac   = State.get().aircraft;
    const C    = CONSTANTS.AIRCRAFT;

    // ── Rotação (yaw) ─────────────────────────────────────────
    let turning = 0;
    if (keys['KeyA'] || keys['ArrowLeft'])  turning -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) turning += 1;
    ac.rotation += turning * C.TURN_SPEED * dt;

    // ── Movimento frente/trás ─────────────────────────────────
    let moving = 0;
    if (keys['KeyW'] || keys['ArrowUp'])   moving -= 1;  // -Z = frente
    if (keys['KeyS'] || keys['ArrowDown']) moving += 1;

    // Direção "frente" baseada na rotação atual
    // sin/cos do yaw dão os componentes X e Z do vetor frente
    const fwdX = Math.sin(ac.rotation);
    const fwdZ = Math.cos(ac.rotation);

    ac.position[0] += fwdX * moving * C.SPEED * dt;
    ac.position[2] += fwdZ * moving * C.SPEED * dt;

    // ── Movimento vertical ────────────────────────────────────
    let vertical = 0;
    if (keys['KeyQ'] || keys['Space']) vertical += 1;
    if (keys['KeyE'] || keys['ShiftLeft']) vertical -= 1;
    ac.position[1] += vertical * C.VERTICAL_SPEED * dt;

    // Limites de altitude
    ac.position[1] = MathUtils.clamp(ac.position[1], C.MIN_HEIGHT, C.MAX_HEIGHT);

    // ── Limites do mundo ──────────────────────────────────────
    const half = CONSTANTS.WORLD.SIZE / 2;
    ac.position[0] = MathUtils.clamp(ac.position[0], -half, half);
    ac.position[2] = MathUtils.clamp(ac.position[2], -half, half);

    // ── Inclinação cosmética (tilt) ───────────────────────────
    // Ao mover para frente: inclina para frente (tiltX negativo)
    // Ao girar: inclina lateralmente (tiltZ)
    const targetTiltX = -moving  * C.TILT_FACTOR;
    const targetTiltZ =  turning * C.TILT_FACTOR;

    // Suavização do tilt com lerp
    ac.tiltX = MathUtils.lerp(ac.tiltX, targetTiltX, C.TILT_RECOVERY * dt);
    ac.tiltZ = MathUtils.lerp(ac.tiltZ, targetTiltZ, C.TILT_RECOVERY * dt);

    // ── Rotação das hélices ───────────────────────────────────
    // Acumula ângulo continuamente (módulo 2π para não crescer infinitamente)
    ac.rotorAngle = (ac.rotorAngle + C.ROTOR_SPEED * dt) % (Math.PI * 2);
  }

  return { update };

})();