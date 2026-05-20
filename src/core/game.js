// ============================================================
// src/core/game.js — Orquestrador Principal
// Responsabilidade: coordenar todos os sistemas no game loop.
//
// FLUXO DO GAME LOOP:
//   requestAnimationFrame(frame)
//     ├── Timing.update(timestamp)    → deltaTime
//     ├── Input.updateHUD()           → atualiza UI
//     ├── MovementSystem.update(dt)   → move aeronave
//     ├── CameraSystem.update(dt)     → suaviza câmera
//     ├── Lighting.update(totalTime)  → anima iluminação
//     └── _render()
//           ├── Renderer.resize()
//           ├── Renderer.clear()
//           ├── Camera.getMatrices()
//           ├── Lighting.toUniforms()
//           ├── Renderer.drawSkybox()
//           ├── Terrain.getRenderObjects() → drawObject (cada)
//           ├── CityGenerator.getBuildingObjects() → drawObject (cada)
//           ├── CityGenerator.getTreeObjects() → drawObject (cada)
//           └── Aircraft.getRenderObjects() → drawObject (cada)
// ============================================================

const Game = (() => {

  let _gl        = null;
  let _programs  = null;
  let _textures  = null;
  let _animId    = null;

  // ── Inicialização ─────────────────────────────────────────────
  async function init() {
    // Obtém o canvas e cria contexto WebGL
    const canvas = document.getElementById('glCanvas');
    if (!canvas) throw new Error('[Game] Canvas #glCanvas não encontrado');

    // Obtém contexto WebGL2 (com fallback para WebGL1)
    _gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!_gl) {
      alert('WebGL não suportado neste navegador. Tente Chrome ou Firefox.');
      return;
    }

    console.log('[Game] Contexto WebGL criado:', _gl.constructor.name);

    // Ajusta resolução do canvas para o devicePixelRatio
    // (evita canvas borrado em telas HiDPI/Retina)
    twgl.resizeCanvasToDisplaySize(canvas);
    _gl.viewport(0, 0, canvas.width, canvas.height);

    // ── Compilar shaders ─────────────────────────────────────
    console.log('[Game] Compilando shaders...');
    try {
      _programs = Shaders.compile(_gl);
    } catch (e) {
      console.error('[Game] Erro ao compilar shaders:', e);
      return;
    }

    // ── Carregar texturas ────────────────────────────────────
    console.log('[Game] Gerando texturas procedurais...');
    _textures = TextureLoader.initAll(_gl);

    // ── Inicializar renderer ──────────────────────────────────
    Renderer.init(_gl, _programs, _textures);

    // ── Gerar mundo ───────────────────────────────────────────
    console.log('[Game] Gerando terreno...');
    Terrain.init(_gl, _textures);

    console.log('[Game] Gerando cidade...');
    CityGenerator.init(_gl, _textures);

    // ── Inicializar entidades ─────────────────────────────────
    Aircraft.init(_gl, _textures);

    // ── Inicializar sistemas ──────────────────────────────────
    Input.init();
    SoundManager.init();

    // ── Iniciar o game loop ───────────────────────────────────
    State.get().game.running = true;
    console.log('[Game] Iniciando game loop...');
    _animId = requestAnimationFrame(_frame);
  }

  // ── Game loop ─────────────────────────────────────────────────
  function _frame(timestamp) {
    // Agenda o próximo frame IMEDIATAMENTE para máxima suavidade
    _animId = requestAnimationFrame(_frame);

    // 1. Atualiza temporização
    Timing.update(timestamp);
    const dt = Timing.getDelta();

    // 2. Atualiza sistemas de lógica
    Input.updateHUD();
    MovementSystem.update(dt);
    CameraSystem.update(dt);
    Lighting.update(Timing.getTotal());

    // 3. Renderiza a cena
    _render();
  }

  // ── Renderização ──────────────────────────────────────────────
  function _render() {
    const gl = _gl;

    // Resize responsivo (adapta ao tamanho da janela)
    Renderer.resize();

    // Limpa color buffer + depth buffer
    Renderer.clear();

    // Obtém matrizes de câmera (view + projection)
    const camMats = Camera.getMatrices(gl);

    // Obtém uniforms de iluminação
    const lightUniforms = Lighting.toUniforms(camMats.eye);

    // ── Skybox (renderizado primeiro, sem depth write) ────────
    Renderer.drawSkybox(camMats);

    // ── Terreno ───────────────────────────────────────────────
    const terrainObjs = Terrain.getRenderObjects();
    for (const obj of terrainObjs) {
      Renderer.drawObject(obj, camMats, lightUniforms);
    }

    // ── Prédios ───────────────────────────────────────────────
    const buildObjs = CityGenerator.getBuildingObjects();
    for (const obj of buildObjs) {
      Renderer.drawObject(obj, camMats, lightUniforms);
    }

    // ── Árvores ───────────────────────────────────────────────
    const treeObjs = CityGenerator.getTreeObjects();
    for (const obj of treeObjs) {
      Renderer.drawObject(obj, camMats, lightUniforms);
    }

    // ── Aeronave (hierárquica — múltiplos render objects) ─────
    const aircraftObjs = Aircraft.getRenderObjects();
    for (const obj of aircraftObjs) {
      Renderer.drawObject(obj, camMats, lightUniforms);
    }
  }

  // Para o game loop (para depuração/pause)
  function stop() {
    if (_animId) cancelAnimationFrame(_animId);
    State.get().game.running = false;
  }

  return { init, stop };

})();