// ============================================================
// src/render/material.js — Sistema de Materiais
// ============================================================

const Material = (() => {

  function create({
    diffuse    = [0.8, 0.8, 0.8],
    ambient    = [0.2, 0.2, 0.2],
    specular   = [0.5, 0.5, 0.5],
    shininess  = 32,
    alpha      = 1.0,
    texture    = null,
    useTexture = false,
  } = {}) {
    return { diffuse, ambient, specular, shininess, alpha, texture, useTexture };
  }

  const PRESETS = {
    concrete: create({
      diffuse:   CONSTANTS.COLORS.BUILDING_A,
      ambient:   [0.12, 0.12, 0.13],
      specular:  [0.05, 0.05, 0.05],
      shininess: 4,
    }),
    glass: create({
      diffuse:   CONSTANTS.COLORS.BUILDING_B,
      ambient:   [0.08, 0.10, 0.15],
      specular:  [0.6, 0.7, 0.8],
      shininess: 128,
    }),
    brick: create({
      diffuse:   CONSTANTS.COLORS.BUILDING_C,
      ambient:   [0.15, 0.10, 0.06],
      specular:  [0.05, 0.04, 0.03],
      shininess: 8,
    }),
    leaves: create({
      diffuse:   CONSTANTS.COLORS.TREE_LEAVES,
      ambient:   [0.05, 0.15, 0.06],
      specular:  [0.02, 0.05, 0.02],
      shininess: 4,
    }),
    wood: create({
      diffuse:   CONSTANTS.COLORS.TREE_TRUNK,
      ambient:   [0.10, 0.06, 0.03],
      specular:  [0.03, 0.02, 0.01],
      shininess: 4,
    }),
    metalLight: create({
      diffuse:   CONSTANTS.COLORS.AIRCRAFT_BODY,
      ambient:   [0.20, 0.22, 0.24],
      specular:  [0.8, 0.8, 0.85],
      shininess: 64,
    }),
    cabineGlass: create({
      diffuse:   CONSTANTS.COLORS.AIRCRAFT_CAB,
      ambient:   [0.05, 0.15, 0.25],
      specular:  [0.9, 0.95, 1.0],
      shininess: 200,
    }),
    metalDark: create({
      diffuse:   CONSTANTS.COLORS.AIRCRAFT_ROTOR,
      ambient:   [0.04, 0.04, 0.05],
      specular:  [0.5, 0.5, 0.55],
      shininess: 80,
    }),
    asphalt: create({
      diffuse:   CONSTANTS.COLORS.ROAD,
      ambient:   [0.05, 0.05, 0.05],
      specular:  [0.01, 0.01, 0.01],
      shininess: 2,
    }),
    grass: create({
      diffuse:   CONSTANTS.COLORS.GROUND,
      ambient:   [0.06, 0.08, 0.04],
      specular:  [0.02, 0.03, 0.01],
      shininess: 4,
    }),
  };

  // toUniforms removido — o Renderer agora monta os uniforms
  // diretamente do objeto material, evitando passar null ao TWGL.

  return { create, PRESETS };

})();