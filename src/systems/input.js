// ============================================================
// src/systems/input.js — Sistema de Input
// Responsabilidade: capturar eventos de teclado e atualizar State.
//
// PADRÃO: mapa de teclas (key map) vs flags individuais.
// O mapa permite verificar múltiplas teclas simultaneamente:
//   isKeyDown('KeyW') && isKeyDown('KeyA') → frente + esquerda
//
// Eventos capturados por aqui; lógica de movimento em movementSystem.js
// Separação: Input não move o avião — apenas registra o que está pressionado.
// ============================================================

const Input = (() => {

  // Mapeamento de teclas especiais para ações únicas (toggle)
  // Ações de toggle são disparadas uma única vez por pressionamento
  const _actionHandlers = {};

  function init() {
    // ── Teclas contínuas (enquanto pressionado) ────────────────
    window.addEventListener('keydown', (e) => {
      State.get().input.keys[e.code] = true;

      // Previne scroll da página com setas
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }

      // Dispara ação única de toggle
      if (_actionHandlers[e.code]) {
        _actionHandlers[e.code]();
      }
    });

    window.addEventListener('keyup', (e) => {
      State.get().input.keys[e.code] = false;
    });

    // ── Teclas de ação (toggle, uma vez por pressionamento) ────

    // Câmera superior
    _actionHandlers['Digit1'] = () => {
      State.get().camera.mode = 'top';
      _updateCameraHUD();
    };

    // Câmera cinemática
    _actionHandlers['Digit2'] = () => {
      State.get().camera.mode = 'cinematic';
      _updateCameraHUD();
    };

    // Alternar ângulo da câmera cinemática
    _actionHandlers['KeyC'] = () => {
      const cam = State.get().camera;
      const angles = ['back', 'front', 'right', 'left'];
      const idx = angles.indexOf(cam.cinematicAngle);
      cam.cinematicAngle = angles[(idx + 1) % angles.length];
      _updateCameraHUD();
    };

    // Toggle de iluminação
    _actionHandlers['KeyL'] = () => {
      State.get().lighting.enabled = !State.get().lighting.enabled;
      const el = document.getElementById('status-light');
      if (el) el.textContent = `💡 Luz: ${State.get().lighting.enabled ? 'ON' : 'OFF'}`;
    };

    // Toggle de mute
    _actionHandlers['KeyM'] = () => {
      SoundManager.toggleMute();
    };

    // Foco no canvas para garantir captura de teclas
    document.getElementById('glCanvas')?.focus();
  }

  function _updateCameraHUD() {
    const cam = State.get().camera;
    const el  = document.getElementById('status-camera');
    if (!el) return;
    if (cam.mode === 'top') {
      el.textContent = '📷 Câmera: Superior';
    } else {
      const labels = { back: 'Traseira', front: 'Frontal', left: 'Esquerda', right: 'Direita' };
      el.textContent = `📷 Cinemática: ${labels[cam.cinematicAngle]}`;
    }
  }

  // Atualiza HUD de status a cada frame
  function updateHUD() {
    const state = State.get();
    const pos   = state.aircraft.position;

    const fpsEl = document.getElementById('status-fps');
    const posEl = document.getElementById('status-pos');

    if (fpsEl) fpsEl.textContent = `FPS: ${state.ui.fps}`;
    if (posEl) posEl.textContent =
      `Pos: (${pos[0].toFixed(0)}, ${pos[1].toFixed(0)}, ${pos[2].toFixed(0)})`;
  }

  return { init, updateHUD };

})();