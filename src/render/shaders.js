// ============================================================
// src/render/shaders.js — Código GLSL dos Shaders
// Responsabilidade: definir os programas que rodam na GPU.
//
// PIPELINE GRÁFICO RESUMIDO:
//  1. CPU envia vértices (posição, normal, UV) via buffers
//  2. Vertex Shader: processa cada vértice (aplica MVP matrix)
//  3. Rasterização: GPU interpola entre vértices
//  4. Fragment Shader: define a cor de cada pixel
//
// TWGL.createProgramInfo() compila e linka os shaders automaticamente.
// ============================================================

const Shaders = (() => {

  // ──────────────────────────────────────────────────────────────
  // SHADER PRINCIPAL — Com iluminação Phong
  // Usado para: aeronave, prédios, árvores, terreno
  // ──────────────────────────────────────────────────────────────

  // VERTEX SHADER
  // Roda uma vez por VÉRTICE.
  // Responsável por:
  //   - Transformar posição local → espaço de clip (gl_Position)
  //   - Calcular posição no espaço de mundo (para iluminação)
  //   - Passar normal transformada para o fragment shader
  //   - Passar coordenadas UV para texturização
  const mainVS = `
    // Precisão: mediump é suficiente para geometria
    precision mediump float;

    // ── Attributes: dados por vértice (do buffer) ──────────────
    attribute vec3 a_position;   // Posição local do vértice
    attribute vec3 a_normal;     // Normal local (direção perpendicular à superfície)
    attribute vec2 a_texcoord;   // Coordenada UV para textura

    // ── Uniforms: dados por draw call (CPU → GPU) ───────────────
    // Matrizes MVP — o coração do pipeline 3D
    uniform mat4 u_model;        // Model: transforma local → mundo
    uniform mat4 u_view;         // View: transforma mundo → espaço da câmera
    uniform mat4 u_projection;   // Projection: aplica perspectiva

    // Matriz de normais: transposta da inversa da model matrix
    // Necessária porque normais NÃO se transformam como posições
    // (escala não-uniforme distorceria as normais sem isso)
    uniform mat3 u_normalMatrix;

    // ── Varyings: dados interpolados → fragment shader ──────────
    varying vec3 v_worldPos;     // Posição no espaço de mundo
    varying vec3 v_normal;       // Normal no espaço de mundo
    varying vec2 v_texcoord;     // UVs para textura

    void main() {
      // Posição no espaço de mundo (para cálculos de iluminação)
      vec4 worldPos = u_model * vec4(a_position, 1.0);
      v_worldPos = worldPos.xyz;

      // Normal transformada para espaço de mundo
      // u_normalMatrix corrige distorção causada por escala não-uniforme
      v_normal = normalize(u_normalMatrix * a_normal);

      // UV passa direto (interpolação linear automática pela GPU)
      v_texcoord = a_texcoord;

      // Posição final no espaço de clip (NDC)
      // gl_Position = Projection × View × World
      gl_Position = u_projection * u_view * worldPos;
    }
  `;

  // FRAGMENT SHADER
  // Roda uma vez por PIXEL (fragmento).
  // Implementa o modelo de iluminação de Phong:
  //
  // Cor_final = Ambiente + Difusa + Especular
  //
  // AMBIENTE:   luz constante, simula luz indireta (sem direção)
  // DIFUSA:     depende do ângulo entre normal e direção da luz
  //             Lambert: intensidade = max(dot(N, L), 0)
  // ESPECULAR:  reflexo brilhante, depende do ângulo de visão
  //             Phong: intensidade = max(dot(R, V), 0)^shininess
const mainFS = `
  precision mediump float;

  varying vec3 v_worldPos;
  varying vec3 v_normal;
  varying vec2 v_texcoord;

  // ── Uniforms de material ─────────────────────────────────
  uniform vec3  u_matDiffuse;
  uniform vec3  u_matAmbient;
  uniform vec3  u_matSpecular;
  uniform float u_matShininess;
  uniform float u_matAlpha;
  uniform bool  u_useTexture;
  uniform sampler2D u_texture;

  // ── Uniforms de iluminação ───────────────────────────────
  uniform vec3  u_lightDir;
  uniform vec3  u_lightColor;
  uniform vec3  u_ambientColor;
  uniform bool  u_lightingEnabled;
  uniform vec3  u_cameraPos;

  // ── Uniforms de neblina ──────────────────────────────────
  // u_fogEnabled: liga/desliga o efeito sem recompilar shader
  // u_fogNear:    distância onde a neblina começa (fragmento visível)
  // u_fogFar:     distância onde a neblina está completa (fragmento oculto)
  // u_fogColor:   cor da neblina (deve combinar com o horizonte do skybox)
  uniform bool  u_fogEnabled;
  uniform float u_fogNear;
  uniform float u_fogFar;
  uniform vec4  u_fogColor;

  // ── Uniforms de tinting por altitude (somente terreno) ───
  // u_heightTint:      ativa o efeito — true somente para a malha do chão
  // u_heightMax:       altura máxima do terreno (10 unidades)
  // u_heightTintColor: cor que aparece nos pontos mais altos (verde claro)
  //
  // Fórmula: t = smoothstep(worldY / heightMax)
  //           cor = mix(baseColor, tintColor, t * 0.55)
  // Resultado: partes baixas → cor da textura de grama original
  //            partes altas  → gradiente para verde mais claro/vívido
  uniform bool  u_heightTint;
  uniform float u_heightMax;
  uniform vec3  u_heightTintColor;

  void main() {
    // ── Cor base: textura ou material sólido ────────────────
    vec4 baseColor;
    if (u_useTexture) {
      baseColor = texture2D(u_texture, v_texcoord);
    } else {
      baseColor = vec4(u_matDiffuse, u_matAlpha);
    }

    // ── Tinting de altitude (visualização de relevo) ─────────
    // Aplicado ANTES da iluminação para que o gradiente de cor
    // seja afetado normalmente pela luz (realista).
    // smoothstep garante transição suave sem banda abrupta.
    if (u_heightTint && u_heightMax > 0.0) {
      float t = clamp(v_worldPos.y / u_heightMax, 0.0, 1.0);
      t = t * t * (3.0 - 2.0 * t);  // smoothstep manual
      baseColor.rgb = mix(baseColor.rgb, u_heightTintColor, t * 0.55);
    }

    // ── Iluminação Phong (idêntica ao original) ─────────────
    vec4 litColor;

    if (!u_lightingEnabled) {
      litColor = baseColor;
    } else {
      vec3 N = normalize(v_normal);
      vec3 L = normalize(-u_lightDir);
      vec3 V = normalize(u_cameraPos - v_worldPos);

      float diff = max(dot(N, L), 0.0);

      vec3  R    = reflect(-L, N);
      float spec = pow(max(dot(R, V), 0.0), u_matShininess);

      vec3 ambient  = u_ambientColor  * u_matAmbient;
      vec3 diffuse  = u_lightColor    * u_matDiffuse  * diff;
      vec3 specular = u_lightColor    * u_matSpecular * spec;

      vec3 lit = (ambient + diffuse) * baseColor.rgb + specular;
      litColor = vec4(lit, baseColor.a * u_matAlpha);
    }

    // ── Neblina linear ──────────────────────────────────────
    // Só executa se u_fogEnabled = true.
    // Usar bool uniform é mais barato que recompilar o shader.
    //
    // 1. Distância euclidiana fragmento → câmera (espaço do mundo)
    //    Mais preciso que usar gl_FragCoord.z porque não depende
    //    da projeção perspectiva (não distorce para câmeras oblíquas).
    //
    // 2. fogFactor: 1.0 = totalmente visível, 0.0 = totalmente neblina
    //    clamp evita valores fora de [0,1] para fragmentos
    //    muito perto (>1) ou muito longe (<0).
    //
    // 3. mix(fogColor, litColor, fogFactor):
    //    fogFactor=1 → litColor puro (perto, sem neblina)
    //    fogFactor=0 → fogColor puro (longe, totalmente encoberto)
    //    fogFactor=0.5 → 50% de cada (transição suave)
    if (u_fogEnabled) {
      float d         = length(u_cameraPos - v_worldPos);
      float fogFactor = clamp(
        (u_fogFar - d) / (u_fogFar - u_fogNear),
        0.0, 1.0
      );
      gl_FragColor = mix(u_fogColor, litColor, fogFactor);
    } else {
      gl_FragColor = litColor;
    }
  }
`;

  // ──────────────────────────────────────────────────────────────
  // SHADER DE CÉU — Gradiente simples sem iluminação
  // ──────────────────────────────────────────────────────────────
  const skyVS = `
    precision mediump float;
    attribute vec3 a_position;
    uniform mat4 u_projection;
    uniform mat4 u_view;
    varying float v_height;  // Passa a altura para o gradiente

    void main() {
      v_height = a_position.y;
      // Remove translação da view matrix (céu sempre em torno da câmera)
      mat4 viewNoTranslation = u_view;
      viewNoTranslation[3] = vec4(0.0, 0.0, 0.0, 1.0);
      gl_Position = u_projection * viewNoTranslation * vec4(a_position, 1.0);
      // Força o céu para o plano mais distante (z=w → profundidade=1)
      gl_Position.z = gl_Position.w;
    }
  `;

  const skyFS = `
    precision mediump float;
    varying float v_height;
    uniform vec4 u_skyTop;
    uniform vec4 u_skyBottom;

    void main() {
      // Gradiente vertical simples entre dois tons de azul
      float t = clamp((v_height + 1.0) * 0.5, 0.0, 1.0);
      gl_FragColor = mix(u_skyBottom, u_skyTop, t);
    }
  `;

  // ──────────────────────────────────────────────────────────────
  // Compilação dos programas via TWGL
  // TWGL.createProgramInfo:
  //   - Compila vertex e fragment shader
  //   - Linka em um programa WebGL
  //   - Mapeia automaticamente locations de attributes e uniforms
  // ──────────────────────────────────────────────────────────────
  function compile(gl) {
    const main = twgl.createProgramInfo(gl, [mainVS, mainFS]);
    const sky  = twgl.createProgramInfo(gl, [skyVS, skyFS]);

    if (!main || !sky) {
      throw new Error('[Shaders] Falha ao compilar shaders. Verifique o console WebGL.');
    }

    return { main, sky };
  }

  return { compile };

})();