// Aplica el tema guardado ANTES de que React pinte, para evitar un destello del tema claro.
// Es un archivo externo (no inline) para respetar la Content-Security-Policy (script-src 'self').
(function () {
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#1a1a2e');
    }
  } catch (e) {
    /* almacenamiento bloqueado: tema claro por defecto */
  }
})();
