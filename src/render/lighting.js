// ============================================================
// src/render/lighting.js — Sistema de Iluminação c/ Ciclo Dia/Noite
//
// CICLO DO SOL:
//   sunAngle avança continuamente em [0, 2π).
//   O sol orbita no plano XZ inclinado:
//     sunX = cos(sunAngle)
//     sunY = sin(sunAngle)   ← positivo = acima do horizonte
//     sunZ = 0.25            ← leve deslocamento fixo para sul
//
//   Fases do dia baseadas em sunY (altura do sol):
//
//     sunY ≥  0.25 → DIA PLENO       (sol alto, luz branca quente)
//     sunY ∈ [-0.1, 0.25) → TARDE/AMANHECER (laranja/rosa)
//     sunY ∈ [-0.3,-0.1)  → CREPÚSCULO     (roxo escuro)
//     sunY  < -0.3 → NOITE            (escuro, ambient mínimo)
//
// SAÍDAS:
//   toUniforms()  → uniforms para o shader de objetos (Phong)
//   getSkyColors()→ { top, bottom } para o shader do skybox
//
// INTEGRAÇÃO:
//   game.js já chama Lighting.update(totalTime) a cada frame.
//   Renderer.drawSkybox() deve chamar Lighting.getSkyColors()
//   em vez de usar CONSTANTS.COLORS diretamente.
// ============================================================

const Lighting = (() => {

  // ── Paleta de cores por fase ─────────────────────────────────
  // Cada entrada: { sunY, lightColor, ambient, skyTop, skyBottom, specular }
  // Interpolamos linearmente entre os dois keyframes mais próximos.
  //
  // sunY = sin(sunAngle): -1 = nadir (meia-noite), +1 = zênite (meio-dia)
  // skyTop e skyBottom são vec4 (RGBA) — o shader do céu declara
  // "uniform vec4 u_skyTop / u_skyBottom" e o WebGL ignora
  // silenciosamente arrays com tamanho errado.
  const KEYFRAMES = [
    // Meia-noite (nadir, sunY = -1.0)
    {
      sunY:      -1.0,
      lightColor: [0.04, 0.05, 0.12],
      ambient:    [0.04, 0.04, 0.08],
      skyTop:     [0.01, 0.01, 0.06, 1.0],
      skyBottom:  [0.03, 0.03, 0.10, 1.0],
      specular:   [0.05, 0.05, 0.10],
    },
    // Hora azul (sunY = -0.25, antes do amanhecer)
    {
      sunY:      -0.25,
      lightColor: [0.10, 0.12, 0.28],
      ambient:    [0.08, 0.09, 0.18],
      skyTop:     [0.04, 0.05, 0.22, 1.0],
      skyBottom:  [0.10, 0.12, 0.28, 1.0],
      specular:   [0.15, 0.15, 0.30],
    },
    // Amanhecer / entardecer (sunY = 0.0, horizonte)
    {
      sunY:       0.0,
      lightColor: [1.00, 0.55, 0.20],
      ambient:    [0.18, 0.12, 0.10],
      skyTop:     [0.30, 0.18, 0.42, 1.0],
      skyBottom:  [0.95, 0.50, 0.20, 1.0],
      specular:   [1.00, 0.70, 0.40],
    },
    // Manhã / tarde (sunY = 0.2, sol baixo)
    {
      sunY:       0.20,
      lightColor: [1.00, 0.92, 0.75],
      ambient:    [0.50, 0.46, 0.40],
      skyTop:     [0.45, 0.65, 0.95, 1.0],
      skyBottom:  [0.85, 0.72, 0.55, 1.0],
      specular:   [1.00, 0.95, 0.80],
    },
    // Meio-dia (zênite, sunY = 1.0)
    {
      sunY:       1.0,
      lightColor: [1.00, 1.00, 0.98],
      ambient:    [0.62, 0.62, 0.65],
      skyTop:     [0.25, 0.52, 0.95, 1.0],
      skyBottom:  [0.65, 0.82, 1.00, 1.0],
      specular:   [1.00, 1.00, 1.00],
    },
  ];

  // ── Estado interno ────────────────────────────────────────────
  // Velocidade: 1 dia completo = DAY_DURATION segundos de tempo real
  const DAY_DURATION = 120;  // 2 minutos por ciclo completo
  const SUN_SPEED    = (Math.PI * 2) / DAY_DURATION;  // rad/s

  // Começa no amanhecer (ângulo tal que sunY ≈ 0, sol subindo)
  // sunY = sin(angle) → angle = 0 dá sunY=0 com sol subindo
  let _sunAngle = 0.0;

  // Resultados interpolados (atualizados em update())
  const _light = {
    direction: [0, -1, 0.25],
    color:     [1, 1, 1],
    ambient:   [0.3, 0.3, 0.3],
    specular:  [1, 1, 1],
  };
  let _skyTop    = [0.18, 0.42, 0.82];
  let _skyBottom = [0.55, 0.72, 0.92];

  // Lerp genérico — funciona para vec3 (lightColor, ambient) e vec4 (skyTop, skyBottom)
  function _lerpVec(a, b, t) {
    const out = [];
    for (let i = 0; i < a.length; i++) out.push(a[i] + (b[i] - a[i]) * t);
    return out;
  }

  // ── Interpola entre keyframes pelo sunY atual ─────────────────
  function _interpolate(sunY) {
    const KF = KEYFRAMES;
    const last = KF.length - 1;

    // Clamp: garante que nunca fica fora dos extremos
    if (sunY <= KF[0].sunY)    return { lightColor: KF[0].lightColor, ambient: KF[0].ambient, skyTop: KF[0].skyTop, skyBottom: KF[0].skyBottom, specular: KF[0].specular };
    if (sunY >= KF[last].sunY) return { lightColor: KF[last].lightColor, ambient: KF[last].ambient, skyTop: KF[last].skyTop, skyBottom: KF[last].skyBottom, specular: KF[last].specular };

    // Busca o índice i tal que KF[i].sunY <= sunY < KF[i+1].sunY
    let i = 0;
    for (; i < last - 1; i++) {
      if (sunY < KF[i+1].sunY) break;
    }
    const lo = KF[i];
    const hi = KF[i+1];

    // t ∈ [0,1] dentro do intervalo
    const range = hi.sunY - lo.sunY;
    const t = range < 1e-6 ? 0 : (sunY - lo.sunY) / range;

    return {
      lightColor: _lerpVec(lo.lightColor, hi.lightColor, t),
      ambient:    _lerpVec(lo.ambient,    hi.ambient,    t),
      skyTop:     _lerpVec(lo.skyTop,     hi.skyTop,     t),
      skyBottom:  _lerpVec(lo.skyBottom,  hi.skyBottom,  t),
      specular:   _lerpVec(lo.specular,   hi.specular,   t),
    };
  }

  // ── update(dt) ────────────────────────────────────────────────
  // Chamado pelo game.js a cada frame com delta time em segundos.
  // Avança o ângulo do sol e recalcula todos os valores de cor.
  function update(dt) {
    // Avança o ângulo do sol
    _sunAngle = (_sunAngle + SUN_SPEED * dt) % (Math.PI * 2);

    // Sincroniza com o State para que outros sistemas possam ler
    State.get().lighting.sunAngle = _sunAngle;

    // Posição do sol no espaço:
    //   sunAngle=0    → nascer (horizonte leste, sunY=0 subindo)
    //   sunAngle=π/2  → meio-dia (sunY=1, zênite)
    //   sunAngle=π    → pôr (horizonte oeste, sunY=0 descendo)
    //   sunAngle=3π/2 → meia-noite (sunY=-1, nadir)
    const sunY = Math.sin(_sunAngle);          // -1..+1
    const sunX = Math.cos(_sunAngle);          // leste/oeste

    // Direção da luz = do sol para a origem (normalizada)
    // Invertemos porque o shader espera "vetor em direção à luz"
    const len = Math.sqrt(sunX*sunX + sunY*sunY + 0.25*0.25);
    _light.direction = [sunX / len, sunY / len, 0.25 / len];

    // Interpola as cores do keyframe mais próximo
    const kf = _interpolate(sunY);
    _light.color    = kf.lightColor;
    _light.ambient  = kf.ambient;
    _light.specular = kf.specular;
    _skyTop         = kf.skyTop;
    _skyBottom      = kf.skyBottom;
  }

  // ── toUniforms() ─────────────────────────────────────────────
  // Uniforms para o shader principal (objetos da cena).
  function toUniforms(cameraPos) {
    const enabled = State.get().lighting.enabled;
    return {
      u_lightDir:        _light.direction,
      u_lightColor:      _light.color,
      u_ambientColor:    enabled ? _light.ambient : [0.8, 0.8, 0.8],
      u_lightingEnabled: enabled,
      u_specularColor:   _light.specular,
      u_cameraPos:       cameraPos,
    };
  }

  // ── getSkyColors() ────────────────────────────────────────────
  // Chamado pelo Renderer.drawSkybox() para obter as cores atuais.
  // Retorna arrays RGB normalizados [0..1].
  function getSkyColors() {
    return { top: _skyTop, bottom: _skyBottom };
  }

  // ── getSunAngle() ─────────────────────────────────────────────
  // Expõe o ângulo atual para debug ou HUD.
  function getSunAngle() { return _sunAngle; }

  return { update, toUniforms, getSkyColors, getSunAngle };

})();
