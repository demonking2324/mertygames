const filterButtons = document.querySelectorAll(".filter-btn");
const gameCards = document.querySelectorAll(".game-card[data-controls]");
const filterEmpty = document.getElementById("filterEmpty");

function applyFilter(filter) {
  let visible = 0;

  gameCards.forEach((card) => {
    const controls = card.dataset.controls || "any";
    const show = filter === "all" || controls === filter;
    card.classList.toggle("hidden", !show);
    if (show) visible += 1;
  });

  if (filterEmpty) {
    filterEmpty.classList.toggle("hidden", visible > 0);
  }
}

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    applyFilter(btn.dataset.filter || "all");
  });
});
