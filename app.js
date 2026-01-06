let currentPage = 1;
const pages = document.getElementById("pages");
const navButtons = document.querySelectorAll("#bottom-nav button");

const STORAGE_KEY = "runs";

/* Load all runs */
function loadRuns() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

/* Save full run list */
function saveRuns(runs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

/* Add a single run */
function addRun(run) {
    const runs = loadRuns();
    runs.push(run);
    saveRuns(runs);
}

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
    const date = document.getElementById("run-date").value;
    const distance = parseFloat(document.getElementById("run-distance").value);
    const timeMinutes = parseFloat(document.getElementById("run-time").value);

    if (!date || !distance || !timeMinutes) {
        alert("Please fill in all fields");
        return;
    }

    const run = {
        id: `manual_${Date.now()}`,
        date,
        distanceKm: distance,
        durationSec: Math.round(timeMinutes * 60),
        source: "manual"
    };

    addRun(run);
    closeModal();

    console.log("Saved runs:", loadRuns());
});

/* Start on home */
goToPage(1);