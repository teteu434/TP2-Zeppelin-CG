# 🌍 OpenWorld WebGL — Cidade Voadora

Motor de mundo aberto 3D construído com **WebGL puro + TWGL.js**, sem Three.js ou Babylon.js.

## 🚀 Como Rodar

```bash
# Qualquer servidor HTTP local funciona:
npx serve .
# ou
python3 -m http.server 8080
# ou
live-server .
```

Abra `http://localhost:8080` no Chrome ou Firefox.

> ⚠️ **Não abra o index.html diretamente** (file://) — WebGL tem restrições de CORS com arquivos locais.

---

## 🎮 Controles

| Tecla | Ação |
|-------|------|
| W / ↑ | Mover para frente |
| S / ↓ | Mover para trás |
| A / ← | Girar à esquerda |
| D / → | Girar à direita |
| Q / Space | Subir |
| E / Shift | Descer |
| **1** | Câmera superior |
| **2** | Câmera cinemática |
| **C** | Alternar ângulo cinemático (frente/trás/esq/dir) |
| **L** | Toggle iluminação Phong |
| **M** | Toggle mute |

---

## 📁 Estrutura de Arquivos

```
openworld-webgl/
│── index.html              # Ponto de entrada + carregamento dos módulos
│── style.css               # Estilos globais + HUD
│
└── src/
    ├── main.js             # Entry point
    │
    ├── core/
    │   ├── game.js         # Orquestrador: inicialização + game loop
    │   ├── state.js        # Estado global (single source of truth)
    │   └── timing.js       # deltaTime, FPS
    │
    ├── render/
    │   ├── shaders.js      # Código GLSL (vertex + fragment shaders)
    │   ├── material.js     # Sistema de materiais Phong
    │   ├── textureLoader.js# Texturas procedurais via Canvas 2D
    │   ├── lighting.js     # Parâmetros de iluminação
    │   ├── camera.js       # Matrizes View e Projection
    │   └── renderer.js     # Draw calls WebGL centralizados
    │
    ├── systems/
    │   ├── input.js        # Captura de teclado
    │   ├── movementSystem.js # Física/movimento da aeronave
    │   └── cameraSystem.js # Delegação de update de câmera
    │
    ├── entities/
    │   ├── aircraft.js     # Disco voador (hierárquico)
    │   ├── building.js     # Prédios (instancing manual)
    │   └── tree.js         # Árvores (tronco + copa)
    │
    ├── world/
    │   ├── terrain.js      # Chão + ruas
    │   └── cityGenerator.js# Geração procedural da cidade
    │
    └── audio/
        └── soundManager.js # Música ambiente via Web Audio API
```

---

## 🏗️ Arquitetura

### Fluxo de Renderização
```
Game.loop()
  ↓
Timing.update()    → deltaTime
  ↓
MovementSystem()   → posição da aeronave
CameraSystem()     → posição da câmera (lerp)
  ↓
Camera.getMatrices() → view + projection
Lighting.toUniforms() → uniforms de luz
  ↓
Renderer.drawSkybox()
Renderer.drawObject() × N   → terreno, cidade, árvores, aeronave
```

### Modelo de Iluminação Phong
```
Cor_final = (Ambiente × matAmbient) 
           + (Difusa × dot(N,L) × matDiffuse) 
           + (Especular × pow(dot(R,V), shininess) × matSpecular)
```

### Hierarquia da Aeronave
```
root (posição + yaw + tilt)
├── corpo        → root × identity
├── cabine       → root × translate(0, 1, 0)
└── rotor/pás    → root × translate(0, 0.5, 0) × rotateY(rotorAngle)
```

---

## 🛠️ Dependências

- **[TWGL.js](https://twgljs.org/)** — Helper WebGL (buffers, uniforms, matrizes)
- **WebGL** — API de renderização da GPU
- **Web Audio API** — Música ambiente procedural

Sem Three.js, Babylon.js ou qualquer engine.

---

## 📊 Especificações Técnicas

- **Shaders**: GLSL ES 1.00 (WebGL 1 compatível)
- **Iluminação**: Phong com luz direcional + ambiente
- **Texturas**: Geradas proceduralmente via Canvas 2D (sem arquivos externos)
- **Câmeras**: Superior (top-down) + Cinemática (4 ângulos) com lerp
- **Geometria**: Procedural (cilindros, cones, caixas, domo esférico)
- **Hierarquia**: Matrix multiplication manual (pai → filho)
- **FPS**: Limitado pelo monitor (vsync via rAF), tipicamente 60fps