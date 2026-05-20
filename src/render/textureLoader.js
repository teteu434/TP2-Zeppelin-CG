// ============================================================
// src/render/textureLoader.js — Carregamento de Texturas
// Responsabilidade: criar texturas WebGL a partir de imagens
//   e gerar texturas procedurais via Canvas 2D.
//
// TEXTURAS PROCEDURAIS:
//   Ao invés de arquivos de imagem externos (que exigiriam servidor),
//   usamos Canvas 2D para DESENHAR texturas em tempo de execução.
//   Isso torna o projeto totalmente autocontido (sem assets externos).
//
// COMO FUNCIONA UMA TEXTURA WebGL:
//   1. Criar objeto textura:      gl.createTexture()
//   2. Fazer bind:                gl.bindTexture()
//   3. Enviar pixels para GPU:    gl.texImage2D()
//   4. Gerar mipmaps (opcional):  gl.generateMipmap()
//   5. Configurar filtros:        gl.texParameteri()
// ============================================================

const TextureLoader = (() => {

  // Cache: evita recriar texturas idênticas
  const _cache = new Map();

  // ── Utilitário: Canvas → Textura WebGL ───────────────────────
  // Converte um elemento <canvas> já desenhado em textura WebGL
  function canvasToTexture(gl, canvas) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Envia o canvas como fonte de pixels para a GPU
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,                   // Mip level 0 (base)
      gl.RGBA,             // Formato interno da GPU
      gl.RGBA,             // Formato da fonte
      gl.UNSIGNED_BYTE,    // Tipo dos dados
      canvas               // Fonte: pode ser <img>, <canvas>, <video>
    );

    // Gera mipmaps: versões menores para renderização distante
    // (evita aliasing — efeito de serrilhado em superfícies distantes)
    gl.generateMipmap(gl.TEXTURE_2D);

    // Filtros de texturização:
    // MIN_FILTER: quando a textura aparece menor que sua resolução
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    // MAG_FILTER: quando a textura aparece maior (zoom in)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // WRAP: o que fazer nas bordas — REPEAT faz a textura se repetir
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    gl.bindTexture(gl.TEXTURE_2D, null);  // Desvincula para segurança
    return texture;
  }

  // ── Textura de Grade/Janelas (fachada de prédio) ─────────────
  function createBuildingTexture(gl, colorA = '#8899aa', colorB = '#dde8f0') {
    const key = `building_${colorA}_${colorB}`;
    if (_cache.has(key)) return _cache.get(key);

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Fundo (concreto)
    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, size, size);

    // Grade de janelas
    const cols = 8, rows = 12;
    const winW = size / cols * 0.65;
    const winH = size / rows * 0.60;
    const padX = (size / cols - winW) / 2;
    const padY = (size / rows - winH) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * (size / cols) + padX;
        const y = r * (size / rows) + padY;

        // Janelas acesas aleatoriamente (seed determinística)
        const lit = ((r * 7 + c * 13) % 5) !== 0;
        ctx.fillStyle = lit ? colorB : '#334455';
        ctx.fillRect(x, y, winW, winH);

        // Reflexo sutil nas janelas
        if (lit) {
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(x, y, winW * 0.5, winH * 0.3);
        }
      }
    }

    const tex = canvasToTexture(gl, canvas);
    _cache.set(key, tex);
    return tex;
  }

  // ── Textura de Grama ─────────────────────────────────────────
  function createGrassTexture(gl) {
    const key = 'grass';
    if (_cache.has(key)) return _cache.get(key);

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base verde
    ctx.fillStyle = '#3a5c2a';
    ctx.fillRect(0, 0, size, size);

    // Variação de tom — ruído visual simples
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const brightness = Math.random() * 0.3 - 0.15;
      const r = Math.round(58  + brightness * 80);
      const g = Math.round(92  + brightness * 80);
      const b = Math.round(42  + brightness * 40);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 3, 3);
    }

    const tex = canvasToTexture(gl, canvas);
    _cache.set(key, tex);
    return tex;
  }

  // ── Textura de Asfalto ───────────────────────────────────────
  function createRoadTexture(gl) {
    const key = 'road';
    if (_cache.has(key)) return _cache.get(key);

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Asfalto base
    ctx.fillStyle = '#363636';
    ctx.fillRect(0, 0, size, size);

    // Granulado de asfalto
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const v = Math.round(45 + Math.random() * 20);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Faixas de sinalização
    ctx.fillStyle = '#f0e050';
    ctx.fillRect(size * 0.48, 0, size * 0.04, size);

    const tex = canvasToTexture(gl, canvas);
    _cache.set(key, tex);
    return tex;
  }

  // ── Textura de Metal ─────────────────────────────────────────
  function createMetalTexture(gl, baseColor = '#cccccc') {
    const key = `metal_${baseColor}`;
    if (_cache.has(key)) return _cache.get(key);

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Gradiente de metal escovado
    const grad = ctx.createLinearGradient(0, 0, size, 0);
    grad.addColorStop(0,   shadeColor(baseColor, -0.2));
    grad.addColorStop(0.3, shadeColor(baseColor, 0.1));
    grad.addColorStop(0.6, shadeColor(baseColor, -0.05));
    grad.addColorStop(1,   shadeColor(baseColor, 0.15));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Linhas de escovado horizontal
    ctx.globalAlpha = 0.12;
    for (let y = 0; y < size; y += 2) {
      ctx.fillStyle = y % 4 === 0 ? '#ffffff' : '#000000';
      ctx.fillRect(0, y, size, 1);
    }
    ctx.globalAlpha = 1.0;

    const tex = canvasToTexture(gl, canvas);
    _cache.set(key, tex);
    return tex;
  }

  // ── Textura de Casca de Árvore ───────────────────────────────
  function createBarkTexture(gl) {
    const key = 'bark';
    if (_cache.has(key)) return _cache.get(key);

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#5c3a1a';
    ctx.fillRect(0, 0, size, size);

    // Riscos verticais simulando casca
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * size;
      const v = Math.round(60 + Math.random() * 40);
      ctx.strokeStyle = `rgb(${v},${Math.round(v*0.55)},${Math.round(v*0.25)})`;
      ctx.lineWidth = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.moveTo(x + Math.random() * 4, 0);
      ctx.lineTo(x + Math.random() * 4, size);
      ctx.stroke();
    }

    const tex = canvasToTexture(gl, canvas);
    _cache.set(key, tex);
    return tex;
  }

  // Utilitário: escurece/clareia cor hex
  function shadeColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent * 255));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent * 255));
    const b = Math.min(255, Math.max(0, (num & 0xff) + percent * 255));
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }

  // Inicializa todas as texturas e retorna mapa { nome: textura }
  function initAll(gl) {
    return {
      building_concrete: createBuildingTexture(gl, '#8899aa', '#c8dae8'),
      building_glass:    createBuildingTexture(gl, '#2a4060', '#6090c0'),
      building_brick:    createBuildingTexture(gl, '#7a4830', '#c07040'),
      grass:             createGrassTexture(gl),
      road:              createRoadTexture(gl),
      metal:             createMetalTexture(gl, '#c8ccd0'),
      bark:              createBarkTexture(gl),
    };
  }

  return { initAll, canvasToTexture };

})();