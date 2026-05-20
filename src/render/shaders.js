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

    // Varyings do vertex shader (interpolados)
    varying vec3 v_worldPos;
    varying vec3 v_normal;
    varying vec2 v_texcoord;

    // ── Uniforms de material ───────────────────────────────────
    uniform vec3  u_matDiffuse;     // Cor difusa do material
    uniform vec3  u_matAmbient;     // Cor ambiente do material
    uniform vec3  u_matSpecular;    // Cor especular do material
    uniform float u_matShininess;   // Expoente especular (quanto maior, mais focado)
    uniform float u_matAlpha;       // Transparência (1.0 = opaco)
    uniform bool  u_useTexture;     // Flag: usar textura ou usar cor sólida
    uniform sampler2D u_texture;    // Sampler da textura

    // ── Uniforms de iluminação ─────────────────────────────────
    uniform vec3  u_lightDir;       // Direção da luz (no espaço de mundo)
    uniform vec3  u_lightColor;     // Cor/intensidade da luz direcional
    uniform vec3  u_ambientColor;   // Cor da luz ambiente global
    uniform bool  u_lightingEnabled;// Toggle de iluminação (tecla L)
    uniform vec3  u_cameraPos;      // Posição da câmera (para especular)

    void main() {
      // ── Cor base: textura ou material sólido ──────────────────
      vec4 baseColor;
      if (u_useTexture) {
        baseColor = texture2D(u_texture, v_texcoord);
      } else {
        baseColor = vec4(u_matDiffuse, u_matAlpha);
      }

      if (!u_lightingEnabled) {
        // Sem iluminação: cor base direta (modo flat)
        gl_FragColor = baseColor;
        return;
      }

      // ── Modelo de Phong ───────────────────────────────────────
      vec3 N = normalize(v_normal);           // Normal normalizada
      vec3 L = normalize(-u_lightDir);        // Direção para a luz
      vec3 V = normalize(u_cameraPos - v_worldPos); // Direção para a câmera

      // COMPONENTE DIFUSA (Lei de Lambert)
      // dot(N, L): cos do ângulo entre normal e luz
      // max(..., 0): sem luz negativa (face traseira = 0)
      float diff = max(dot(N, L), 0.0);

      // COMPONENTE ESPECULAR (Phong)
      // R: vetor de reflexão da luz na superfície
      vec3  R    = reflect(-L, N);
      // dot(R, V): quão alinhado está o reflexo com a câmera
      float spec = pow(max(dot(R, V), 0.0), u_matShininess);

      // COMPOSIÇÃO FINAL:
      vec3 ambient  = u_ambientColor  * u_matAmbient;
      vec3 diffuse  = u_lightColor    * u_matDiffuse  * diff;
      vec3 specular = u_lightColor    * u_matSpecular * spec;

      // Aplica iluminação sobre a cor da textura/material
      vec3 lit = (ambient + diffuse) * baseColor.rgb + specular;

      gl_FragColor = vec4(lit, baseColor.a * u_matAlpha);
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