// ============================================================
// src/audio/soundManager.js — Gerenciador de Áudio
// Responsabilidade: tocar música de fundo em loop via HTMLAudioElement.
//
// Usa HTMLAudioElement para o mp3 (simples e confiável) +
// Web Audio API apenas para controle de volume via GainNode.
// Isso evita limitações de autoplay: a música só inicia após
// o primeiro gesto do usuário (keydown ou click).
// ============================================================

const SoundManager = (() => {

  let _audio      = null;   // HTMLAudioElement
  let _audioCtx   = null;   // AudioContext (Web Audio API)
  let _gainNode   = null;   // GainNode para controle de volume
  let _source     = null;   // MediaElementSourceNode
  let _started    = false;

  function _startMusic() {
    if (_started) return;
    _started = true;

    try {
      // ── HTMLAudioElement ──────────────────────────────────────
      _audio = new Audio("public/audio/elevatorMusic.mp3");
      _audio.loop = true;       // Loop contínuo
      _audio.volume = 1.0;      // Volume controlado pelo GainNode

      // ── Web Audio API: roteamento para GainNode ───────────────
      // HTMLAudioElement → MediaElementSourceNode → GainNode → Destino
      // Isso permite controle de volume e mute sem mexer no .volume do elemento
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      _gainNode = _audioCtx.createGain();
      _gainNode.gain.value = State.get().audio.volume;
      _gainNode.connect(_audioCtx.destination);

      _source = _audioCtx.createMediaElementSource(_audio);
      _source.connect(_gainNode);

      // Inicia a reprodução (permitido pois estamos dentro de um gesto do usuário)
      _audio.play().catch(e => {
        console.warn('[SoundManager] Falha ao reproduzir áudio:', e);
      });

    } catch (e) {
      console.warn('[SoundManager] Erro ao inicializar áudio:', e);
    }
  }

  // Inicia na primeira interação (keydown ou click)
  // Browsers bloqueiam autoplay sem gesto do usuário
  function init() {
    const startOnce = () => {
      _startMusic();
      window.removeEventListener('keydown', startOnce);
      window.removeEventListener('click',   startOnce);
    };
    window.addEventListener('keydown', startOnce);
    window.addEventListener('click',   startOnce);
  }

  function toggleMute() {
    const audio = State.get().audio;
    audio.muted = !audio.muted;
    if (_gainNode) {
      _gainNode.gain.value = audio.muted ? 0 : audio.volume;
    }
  }

  function setVolume(v) {
    State.get().audio.volume = v;
    if (_gainNode && !State.get().audio.muted) {
      _gainNode.gain.value = v;
    }
  }

  return { init, toggleMute, setVolume };

})();