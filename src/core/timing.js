// ============================================================
// src/core/timing.js — Temporização e deltaTime
// Responsabilidade: fornecer deltaTime estável para todos os sistemas.
//
// POR QUE deltaTime?
//   Sem deltaTime: velocidade = 5 unidades/frame
//     → em 30fps: 150 u/s | em 60fps: 300 u/s (INCONSISTENTE)
//   Com deltaTime: velocidade = 50 unidades/segundo
//     → em 30fps: 50/30 ≈ 1.67u/frame | em 60fps: 50/60 ≈ 0.83u/frame
//     → resultado: 50 u/s independente do FPS (CONSISTENTE)
// ============================================================

const Timing = (() => {

  let _lastTime    = 0;     // Timestamp do frame anterior (ms)
  let _deltaTime   = 0;     // Tempo entre frames (segundos)
  let _totalTime   = 0;     // Tempo total de execução (segundos)
  let _frameCount  = 0;     // Contador de frames
  let _fpsAccum    = 0;     // Acumulador para cálculo de FPS
  let _fps         = 0;     // FPS médio calculado

  // Chamado uma vez por frame, antes dos sistemas de update
  // timestamp: valor em ms fornecido por requestAnimationFrame
  function update(timestamp) {
    if (_lastTime === 0) {
      // Primeiro frame: inicializa sem gerar deltaTime gigante
      _lastTime = timestamp;
      return;
    }

    // Calcula deltaTime em segundos
    const rawDelta = (timestamp - _lastTime) / 1000;
    _lastTime = timestamp;

    // CAP: se o tab ficou inativo, deltaTime pode ser enorme.
    // Limitamos para evitar que objetos "teletransportem".
    _deltaTime = Math.min(rawDelta, CONSTANTS.PERF.MAX_DELTA);

    _totalTime += _deltaTime;
    _frameCount++;

    // Cálculo de FPS: média por amostragem
    _fpsAccum += _deltaTime;
    if (_fpsAccum >= 0.5) {  // Atualiza FPS a cada 0.5s
      _fps = Math.round(_frameCount / _fpsAccum);
      _fpsAccum = 0;
      _frameCount = 0;
    }

    // Sincroniza com o Estado global
    State.get().ui.fps   = _fps;
    State.get().game.totalTime = _totalTime;
  }

  function getDelta()  { return _deltaTime; }
  function getTotal()  { return _totalTime; }
  function getFPS()    { return _fps; }

  return { update, getDelta, getTotal, getFPS };

})();