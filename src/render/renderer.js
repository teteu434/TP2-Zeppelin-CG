// ============================================================
// src/render/renderer.js — Renderer Central
// ============================================================

const Renderer = (() => {

  let _gl            = null;
  let _programs      = null;
  let _skyBufferInfo = null;
  let _fallbackTex   = null;  // Textura branca 1×1 — usada quando mat.texture=null

  // ── Inicialização ─────────────────────────────────────────────
  function init(gl, programs, textures) {
    _gl       = gl;
    _programs = programs;

    // Depth Test
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Face Culling
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // Blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ── Textura de fallback (branca 1×1) ─────────────────────
    // TWGL não aceita null em u_texture — sempre precisamos de uma
    // textura WebGL válida. Esta é usada quando o material não tem textura.
    _fallbackTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, _fallbackTex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255])  // pixel branco opaco
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Skybox
    _skyBufferInfo = _createSkybox(gl);
  }

  // ── Draw call principal ───────────────────────────────────────
  function drawObject(renderObject, camMatrices, lightUniforms, fogUniforms) {
    const gl   = _gl;
    const prog = _programs.main;

    // Polygon offset: desloca o valor de profundidade do fragmento para frente da
    // câmera no espaço NDC. Usado nas ruas para evitar z-fighting com o chão
    // (rua e chão coplanares → depth buffer perde precisão a distâncias maiores).
    const usePolyOffset = !!renderObject.polygonOffset;
    if (usePolyOffset) {
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-1.0, -2.0);
    }

    gl.useProgram(prog.program);

    const modelMat   = renderObject.modelMat;
    const normalMat3 = _computeNormalMatrix(modelMat);

    const mat = renderObject.material;

    // Resolve a textura: usa a do material ou o fallback branco
    // NUNCA passamos null para o TWGL — isso causa o TypeError
    const resolvedTexture = (mat.useTexture && mat.texture) ? mat.texture : _fallbackTex;
    const useTexture      = !!(mat.useTexture && mat.texture);

  const uniforms = {
    u_model:          modelMat,
    u_view:           camMatrices.view,
    u_projection:     camMatrices.projection,
    u_normalMatrix:   normalMat3,
    u_matDiffuse:     mat.diffuse,
    u_matAmbient:     mat.ambient,
    u_matSpecular:    mat.specular,
    u_matShininess:   mat.shininess,
    u_matAlpha:       mat.alpha !== undefined ? mat.alpha : 1.0,
    u_useTexture:     useTexture,
    u_texture:        resolvedTexture,
    ...lightUniforms,
    ...fogUniforms,   // <-- adiciona os 4 uniforms de fog
  };

    twgl.setUniforms(prog, uniforms);
    twgl.setBuffersAndAttributes(gl, prog, renderObject.bufferInfo);
    twgl.drawBufferInfo(
      gl,
      renderObject.bufferInfo,
      renderObject.primitiveType || gl.TRIANGLES
    );

    if (usePolyOffset) {
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
  }

  // ── Skybox ────────────────────────────────────────────────────
  function drawSkybox(camMatrices) {
    const gl = _gl;
    gl.useProgram(_programs.sky.program);
    gl.depthMask(false);

    // Cores dinâmicas do ciclo dia/noite.
    // Fallback para as constantes originais caso Lighting não exista.
    const skyColors = (typeof Lighting !== 'undefined' && Lighting.getSkyColors)
      ? Lighting.getSkyColors()
      : { top: CONSTANTS.COLORS.SKY_TOP, bottom: CONSTANTS.COLORS.SKY_BOTTOM };

    twgl.setUniforms(_programs.sky, {
      u_projection: camMatrices.projection,
      u_view:       camMatrices.view,
      u_skyTop:     skyColors.top,
      u_skyBottom:  skyColors.bottom,
    });

    twgl.setBuffersAndAttributes(gl, _programs.sky, _skyBufferInfo);
    twgl.drawBufferInfo(gl, _skyBufferInfo);
    gl.depthMask(true);
  }

  // ── Clear ─────────────────────────────────────────────────────
  function clear() {
    _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);
  }

  // ── Resize ────────────────────────────────────────────────────
  function resize() {
    twgl.resizeCanvasToDisplaySize(_gl.canvas);
    _gl.viewport(0, 0, _gl.canvas.width, _gl.canvas.height);
  }

  // ── Normal Matrix ─────────────────────────────────────────────
  function _computeNormalMatrix(m4) {
    const m3 = [
      m4[0], m4[1], m4[2],
      m4[4], m4[5], m4[6],
      m4[8], m4[9], m4[10],
    ];
    return _transposeMat3(_invertMat3(m3));
  }

  function _invertMat3(m) {
    const [a,b,c, d,e,f, g,h,i] = m;
    const det = a*(e*i-f*h) - b*(d*i-f*g) + c*(d*h-e*g);
    if (Math.abs(det) < 1e-8) return m;
    const id = 1 / det;
    return [
      (e*i-f*h)*id, (c*h-b*i)*id, (b*f-c*e)*id,
      (f*g-d*i)*id, (a*i-c*g)*id, (c*d-a*f)*id,
      (d*h-e*g)*id, (b*g-a*h)*id, (a*e-b*d)*id,
    ];
  }

  function _transposeMat3(m) {
    return [m[0],m[3],m[6], m[1],m[4],m[7], m[2],m[5],m[8]];
  }

  // ── Skybox geometry ───────────────────────────────────────────
  function _createSkybox(gl) {
    const S = 500;
    const positions = new Float32Array([
      -S,-S,-S,  S,-S,-S,  S, S,-S,   -S,-S,-S,  S, S,-S,  -S, S,-S,
      -S,-S, S,  -S, S, S,  S, S, S,   -S,-S, S,   S, S, S,  S,-S, S,
      -S,-S,-S,  -S, S,-S,  -S, S, S,  -S,-S,-S,  -S, S, S, -S,-S, S,
       S,-S,-S,   S,-S, S,   S, S, S,   S,-S,-S,   S, S, S,  S, S,-S,
      -S, S,-S,   S, S,-S,   S, S, S,  -S, S,-S,   S, S, S, -S, S, S,
      -S,-S,-S,  -S,-S, S,   S,-S, S,  -S,-S,-S,   S,-S, S,  S,-S,-S,
    ]);
    return twgl.createBufferInfoFromArrays(gl, {
      a_position: { numComponents: 3, data: positions },
    });
  }

  return { init, drawObject, drawSkybox, clear, resize };

})();