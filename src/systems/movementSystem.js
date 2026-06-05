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

  // Retorna a altura máxima do sólido sob (px, pz) em espaço de mundo.
  // Usa b.terrainY para converter a altura local do objeto para espaço de mundo.
  // Se terrainY não está definido, assume 0 (compatibilidade com dados antigos).
  function _getMaxHeightAt(px, pz, bounds) {
    const MARGIN = 6.0;
    let maxH = 0;

    for (const b of bounds) {
      const inX = px > b.minX - MARGIN && px < b.maxX + MARGIN;
      const inZ = pz > b.minZ - MARGIN && pz < b.maxZ + MARGIN;
      if (!inX || !inZ) continue;

      const by = b.terrainY || 0;  // base do objeto no mundo

      // Altura do corpo — convertida para espaço de mundo
      maxH = Math.max(maxH, by + b.bodyHeight);

      // ── Pirâmide (brick) ────────────────────────────────────
      if (b.topScale > 0) {
        const pyMinX = b.minX + b.topOffsetX - MARGIN;
        const pyMaxX = b.minX + b.topOffsetX + b.topScale + MARGIN;
        const pyMinZ = b.minZ + b.topOffsetZ - MARGIN;
        const pyMaxZ = b.minZ + b.topOffsetZ + b.topScale + MARGIN;

        if (px > pyMinX && px < pyMaxX && pz > pyMinZ && pz < pyMaxZ) {
          const cx = (b.minX + b.topOffsetX + b.topScale / 2);
          const cz = (b.minZ + b.topOffsetZ + b.topScale / 2);
          const dx = Math.abs(px - cx) / (b.topScale / 2 + MARGIN);
          const dz = Math.abs(pz - cz) / (b.topScale / 2 + MARGIN);
          const t  = Math.max(dx, dz);
          const pyH = b.topScale * 0.5;
          const heightAtPoint = by + b.bodyHeight + pyH * Math.max(0, 1 - t);
          maxH = Math.max(maxH, heightAtPoint);
        }
      }

      // ── Caixa de cobertura (glass) ──────────────────────────
      if (b.covH > 0) {
        if (px > b.covMinX - MARGIN && px < b.covMaxX + MARGIN &&
            pz > b.covMinZ - MARGIN && pz < b.covMaxZ + MARGIN) {
          maxH = Math.max(maxH, by + b.bodyHeight + b.covH);
        }
      }
    }

    return maxH;
  }

  function update(dt) {
    const keys = State.get().input.keys;
    const ac   = State.get().aircraft;
    const C    = CONSTANTS.AIRCRAFT;

    // ── Rotação (yaw) ─────────────────────────────────────────
    let turning = 0;
    if (keys['KeyA'] || keys['ArrowLeft'])  turning += 1;
    if (keys['KeyD'] || keys['ArrowRight']) turning -= 1;
    ac.rotation += turning * C.TURN_SPEED * dt;

    // ── Movimento frente/trás ─────────────────────────────────
    let moving = 0;
    if (keys['KeyW'] || keys['ArrowUp'])   moving += 1;
    if (keys['KeyS'] || keys['ArrowDown']) moving -= 1;

    const fwdX = Math.sin(ac.rotation);
    const fwdZ = Math.cos(ac.rotation);

    const newX = ac.position[0] + fwdX * moving * C.SPEED * dt;
    const newZ = ac.position[2] + fwdZ * moving * C.SPEED * dt;

    // ── Movimento vertical ────────────────────────────────────
    let vertical = 0;
    if (keys['KeyQ'] || keys['Space'])     vertical += 1;
    if (keys['KeyE'] || keys['ShiftLeft']) vertical -= 1;
    const newY = MathUtils.clamp(
      ac.position[1] + vertical * C.VERTICAL_SPEED * dt,
      C.MIN_HEIGHT, C.MAX_HEIGHT
    );

    // ── Colisão lateral (impede atravessar paredes) ───────────
    const MARGIN = 6.0;
    const bounds = CityGenerator.getBuildingBounds();
    let blockedX = false;
    let blockedZ = false;

    for (const b of bounds) {
      // Altura real do topo no espaço de mundo (terrainY + altura local)
      const by    = b.terrainY || 0;
      const fullH = by + b.bodyHeight + Math.max(b.topScale * 0.5, b.covH);
      if (newY >= fullH + MARGIN) continue;

      const inX_new = newX > b.minX - MARGIN && newX < b.maxX + MARGIN;
      const inZ_new = newZ > b.minZ - MARGIN && newZ < b.maxZ + MARGIN;
      const inX_cur = ac.position[0] > b.minX - MARGIN && ac.position[0] < b.maxX + MARGIN;
      const inZ_cur = ac.position[2] > b.minZ - MARGIN && ac.position[2] < b.maxZ + MARGIN;

      if (inX_new && inZ_new) {
        if (!inX_cur) blockedX = true;
        if (!inZ_cur) blockedZ = true;
      }
    }

    const resolvedX = blockedX ? ac.position[0] : newX;
    const resolvedZ = blockedZ ? ac.position[2] : newZ;

    // ── Colisão vertical — terreno + sólidos ─────────────────────
    // terrainFloor: altura do terreno na posição resolvida (pode ser > 0 com height map)
    // floorHere:    altura do sólido mais alto sob a nave (edifícios, árvores, etc.)
    // minAllowedY:  máximo entre (terreno + MIN_HEIGHT) e (topo do sólido + MARGIN)
    const terrainFloor = HeightMap.getHeight(resolvedX, resolvedZ);
    const floorHere    = _getMaxHeightAt(resolvedX, resolvedZ, bounds);
    const minAllowedY  = Math.max(terrainFloor + C.MIN_HEIGHT, floorHere + MARGIN);
    const resolvedY    = Math.max(newY, minAllowedY);

    ac.position[0] = resolvedX;
    ac.position[1] = resolvedY;
    ac.position[2] = resolvedZ;

    // ── Limites do mundo ──────────────────────────────────────
    const half = CONSTANTS.WORLD.SIZE / 2;
    ac.position[0] = MathUtils.clamp(ac.position[0], -half, half);
    ac.position[2] = MathUtils.clamp(ac.position[2], -half, half);

    // ── Inclinação cosmética (tilt) ───────────────────────────
    const targetTiltX = -moving  * C.TILT_FACTOR;
    const targetTiltZ =  turning * C.TILT_FACTOR;
    ac.tiltX = MathUtils.lerp(ac.tiltX, targetTiltX, C.TILT_RECOVERY * dt);
    ac.tiltZ = MathUtils.lerp(ac.tiltZ, targetTiltZ, C.TILT_RECOVERY * dt);

    // ── Rotação do rotor lateral ──────────────────────────────
    ac.rotorAngle = (ac.rotorAngle + C.ROTOR_SPEED * dt) % (Math.PI * 2);

    // ── Movimento visual suave da nave ───────────────────────
    ac.visualTime = (ac.visualTime || 0) + dt;
    const t = ac.visualTime;
    ac.hoverOffset = Math.sin(t * 1.25) * 0.35;
    ac.wobbleX = Math.sin(t * 0.85) * 0.025;
    ac.wobbleZ = Math.cos(t * 1.05) * 0.025;
  }

  return { update };

})();