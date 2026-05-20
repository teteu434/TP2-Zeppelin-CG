// ============================================================
// src/main.js — Entry Point
// Responsabilidade: inicializar o jogo quando o DOM estiver pronto.
//
// Por que DOMContentLoaded?
//   Os scripts são carregados no <body> em ordem, então os módulos
//   já estão disponíveis. DOMContentLoaded garante que o canvas
//   também está no DOM antes de tentarmos obter o contexto WebGL.
// ============================================================

window.addEventListener('DOMContentLoaded', async () => {

  try {
    await Game.init();
    console.log('✅ OpenWorld WebGL iniciado com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao inicializar OpenWorld WebGL:', err);
  }
});