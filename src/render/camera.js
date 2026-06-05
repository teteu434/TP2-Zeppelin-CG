// ============================================================
// src/render/camera.js — Sistema de Câmera
// Responsabilidade: calcular as matrizes View e Projection.
//
// MATRIZES DE CÂMERA:
//
//   PROJECTION (perspectiva):
//     Simula como nossos olhos veem o mundo.
//     Objetos distantes aparecem menores.
//     Criada com FOV, aspect ratio, near e far planes.
//     TWGL: twgl.m4.perspective(fovRad, aspect, near, far)
//
//   VIEW:
//     Descreve a posição e orientação da câmera.
//     É o inverso da transformação da câmera:
//       "mover a câmera para direita" = "mover o mundo para esquerda"
//     TWGL: twgl.m4.lookAt(eye, target, up) → invertida com m4.inverse()
//     OU:   twgl.m4.inverse(twgl.m4.lookAt(...))
//
//   LOOKATLEFT (eye, center, up):
//     eye:    posição da câmera no mundo
//     center: ponto para onde a câmera olha
//     up:     vetor "para cima" da câmera (geralmente [0,1,0])
// ============================================================

const Camera = (() => {

  // Matrices reutilizáveis (evita garbage collection a cada frame)
  const _projMat = twgl.m4.identity();
  const _viewMat = twgl.m4.identity();

  // ── Câmera superior ──────────────────────────────────────────
  // Posicionada diretamente acima do avião, olhando para baixo.
  // Boa para visualizar a cidade como um todo.
  function _computeTopCamera(aircraftPos) {
    const h = CONSTANTS.CAMERA.TOP_HEIGHT;
    const eye    = [aircraftPos[0], aircraftPos[1] + h, aircraftPos[2]];
    const target = [aircraftPos[0], aircraftPos[1],     aircraftPos[2]];
    // Up: câmera "de cima" com up=[0,1,0] resulta em rotação arbitrária.
    // Usamos [0,0,-1] para que o norte da câmera aponte para -Z.
    const up     = [0, 0, -1];
    return { eye, target, up };
  }

  // ── Câmera cinemática ─────────────────────────────────────────
  // Posicionada ao redor da aeronave a uma distância e altura fixas.
  // O ângulo varia conforme o modo (front, back, left, right).
  function _computeCinematicCamera(aircraftPos, aircraftRotation, angleMode) {
    const dist = CONSTANTS.CAMERA.CINEMATIC_DISTANCE;
    const h    = CONSTANTS.CAMERA.CINEMATIC_HEIGHT;

    // Offset angular por modo de câmera
    const angleOffsets = {
      'back':  Math.PI,           // Atrás do avião
      'front': 0,     // Frente
      'right': Math.PI / 2,
      'left':  -Math.PI / 2,
    };

    const offset = angleOffsets[angleMode] ?? 0;
    const angle  = aircraftRotation + offset;

    // Posição da câmera em coordenadas polares ao redor do avião
    const eye = [
      aircraftPos[0] + Math.sin(angle) * dist,
      aircraftPos[1] + h,
      aircraftPos[2] + Math.cos(angle) * dist,
    ];

    const target = [aircraftPos[0], aircraftPos[1] + 2, aircraftPos[2]];
    const up = [0, 1, 0];
    return { eye, target, up };
  }

  // ── Update: calcula destinos e aplica lerp ────────────────────
  // Chamado uma vez por frame pelo CameraSystem
  function update(dt) {
    const state    = State.get();
    const ac       = state.aircraft;
    const cam      = state.camera;

    // Calcula posição desejada conforme o modo
    let desired;
    if (cam.mode === 'top') {
      desired = _computeTopCamera(ac.position);
    } else {
      desired = _computeCinematicCamera(ac.position, ac.rotation, cam.cinematicAngle);
    }

    // Lerp: suaviza transição de câmera (evita cortes bruscos)
    // LERP_SPEED define quão rápido a câmera alcança a posição desejada
    const t = MathUtils.clamp(CONSTANTS.CAMERA.LERP_SPEED, 0, 1);

    MathUtils.lerpVec3(cam.position, cam.position, desired.eye,    t);
    MathUtils.lerpVec3(cam.target,   cam.target,   desired.target, t);

    // up vector não é interpolado — depende do modo de câmera.
    // Sem este update, a câmera superior usa up=[0,1,0] que é paralelo ao
    // forward=[0,-1,0] → produto vetorial nulo → matriz degenera → tela preta.
    cam.up[0] = desired.up[0];
    cam.up[1] = desired.up[1];
    cam.up[2] = desired.up[2];
  }

  // ── Gera matrizes WebGL para o renderer ──────────────────────
  function getMatrices(gl) {
    const cam = State.get().camera;

    // PROJECTION: perspectiva com aspect ratio do canvas
    const aspect = gl.canvas.width / gl.canvas.height;
    twgl.m4.perspective(
      MathUtils.toRad(CONSTANTS.CAMERA.FOV_DEG),
      aspect,
      CONSTANTS.CAMERA.NEAR,
      CONSTANTS.CAMERA.FAR,
      _projMat
    );

    // VIEW: lookAt invertido
    // twgl.m4.lookAt cria a CÂMERA no espaço de mundo
    // Para a view matrix, precisamos do INVERSO (mundo relativo à câmera)
    const lookAt = twgl.m4.lookAt(cam.position, cam.target, cam.up);
    twgl.m4.inverse(lookAt, _viewMat);

    return {
      projection: _projMat,
      view:       _viewMat,
      eye:        [...cam.position],
    };
  }

  return { update, getMatrices };

})();