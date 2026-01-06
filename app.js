let currentPage = 1;
const pages = document.getElementById("pages");
const navButtons = document.querySelectorAll("#bottom-nav button");

/* Navigation */
function goToPage(index) {
    currentPage = index;
    pages.style.transform = `translateX(-${index * 100}vw)`;

    // toggle active dot
    navButtons.forEach((btn, i) => {
        if (i === index) btn.classList.add("active");
        else btn.classList.remove("active");
    });
}

/* Swipe handling */
let startX = 0;

pages.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
});

pages.addEventListener("touchend", e => {
    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;

    if (Math.abs(diff) > 50) {
        if (diff < 0 && currentPage < 2) currentPage++;
        if (diff > 0 && currentPage > 0) currentPage--;
        goToPage(currentPage);
    }
});

/* Modal */
function openModal() {
    const modal = document.getElementById("modal");
    modal.classList.add("show");
    // initialize date to today
    document.getElementById("run-date").valueAsDate = new Date();
}

function closeModal() {
    const modal = document.getElementById("modal");
    modal.classList.remove("show");

    document.getElementById("run-distance").value = "";
    document.getElementById("run-time").value = "";
}

// close modal when tapping outside content
document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") {
        closeModal();
    }
});

document.getElementById("add-run-confirm").addEventListener("click", () => {
    closeModal();
});

/* Start on home */
goToPage(1);