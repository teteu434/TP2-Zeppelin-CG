// ============================================================
// src/utils/math.js — Utilitários Matemáticos 3D
// Responsabilidade: operações vetoriais e escalares puras.
// Funções puras (sem efeitos colaterais) — fáceis de testar.
// ============================================================

const MathUtils = (() => {

  // ── Conversões angulares ─────────────────────────────────────
  const DEG_TO_RAD = Math.PI / 180;
  const RAD_TO_DEG = 180 / Math.PI;

  function toRad(deg) { return deg * DEG_TO_RAD; }
  function toDeg(rad) { return rad * RAD_TO_DEG; }

  // ── Interpolação linear (lerp) ───────────────────────────────
  // Usado para suavizar movimentos de câmera e objetos.
  // t=0 retorna a, t=1 retorna b.
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // lerp vetorial: suaviza posição/rotação de câmeras
  function lerpVec3(out, a, b, t) {
    out[0] = lerp(a[0], b[0], t);
    out[1] = lerp(a[1], b[1], t);
    out[2] = lerp(a[2], b[2], t);
    return out;
  }

  // ── Clamp ────────────────────────────────────────────────────
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // ── Operações vetoriais ──────────────────────────────────────

  // Soma de vetores 3D
  function addVec3(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
  }

  // Subtração
  function subVec3(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
  }

  // Escalar um vetor
  function scaleVec3(out, v, s) {
    out[0] = v[0] * s;
    out[1] = v[1] * s;
    out[2] = v[2] * s;
    return out;
  }

  // Comprimento (magnitude) do vetor
  function lengthVec3(v) {
    return Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  }

  // Normalização (torna o vetor unitário)
  function normalizeVec3(out, v) {
    const len = lengthVec3(v);
    if (len < 1e-6) { out[0]=0; out[1]=0; out[2]=0; return out; }
    out[0] = v[0] / len;
    out[1] = v[1] / len;
    out[2] = v[2] / len;
    return out;
  }

  // Produto escalar (dot product) — usado em iluminação
  // dot(a, b) = |a||b|cos(θ) → mede alinhamento entre vetores
  function dotVec3(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  }

  // Produto vetorial (cross product) — gera normal perpendicular
  function crossVec3(out, a, b) {
    out[0] = a[1]*b[2] - a[2]*b[1];
    out[1] = a[2]*b[0] - a[0]*b[2];
    out[2] = a[0]*b[1] - a[1]*b[0];
    return out;
  }

  // ── Aleatoriedade com semente controlada ─────────────────────
  // Importante para gerar a cidade de forma determinística
  // (mesma semente → mesma cidade sempre)
  function seededRandom(seed) {
    // Gerador congruencial linear simples
    let s = seed;
    return function() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;  // [0, 1)
    };
  }

  // Número aleatório entre min e max (usando função de random)
  function randRange(rng, min, max) {
    return min + rng() * (max - min);
  }

  // Inteiro aleatório entre min e max inclusive
  function randInt(rng, min, max) {
    return Math.floor(randRange(rng, min, max + 1));
  }

  // ── Cálculo de normais de triângulo ─────────────────────────
  // Essencial para iluminação: a normal define como a luz incide
  // Dados 3 vértices em sentido anti-horário, retorna normal
  function computeTriangleNormal(out, p0, p1, p2) {
    const e1 = [p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]];
    const e2 = [p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]];
    crossVec3(out, e1, e2);
    normalizeVec3(out, out);
    return out;
  }

  // ── Exposição pública ────────────────────────────────────────
  return {
    toRad, toDeg,
    lerp, lerpVec3,
    clamp,
    addVec3, subVec3, scaleVec3,
    lengthVec3, normalizeVec3,
    dotVec3, crossVec3,
    seededRandom, randRange, randInt,
    computeTriangleNormal,
  };

})();