/* ============================================================
 * Bootstrap — wire the menu to the game.
 * ============================================================ */

window.addEventListener("DOMContentLoaded", () => {
  const game = new Game();
  new Menu((config) => game.start(config));
  window.game = game; // handy for debugging in the console
});
