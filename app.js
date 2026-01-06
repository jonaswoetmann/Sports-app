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

/* --- Calculations for cumulative distances --- */

// Group runs by year
function groupRunsByYear(runs) {
    const years = {};
    runs.forEach(run => {
        const year = new Date(run.date).getFullYear();
        if (!years[year]) years[year] = [];
        years[year].push(run);
    });
    return years;
}

// Sort runs by date
function sortRunsByDate(runs) {
    return runs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
}

/* Compute cumulative distance per day for a specific year (full year) */
function cumulativeDistanceByDay(runs, year) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);

    // Sort runs and sum cumulative per date
    const runsOfYear = sortRunsByDate(runs.filter(r => new Date(r.date).getFullYear() === year));
    const runsByDate = {};
    let total = 0;
    runsOfYear.forEach(run => {
        total += run.distanceKm;
        runsByDate[run.date] = total;
    });

    // Build cumulative array for every day of the year
    const result = [];
    let runningTotal = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        if (runsByDate[dateStr] !== undefined) runningTotal = runsByDate[dateStr];
        result.push({ date: dateStr, cumulative: runningTotal });
    }
    return result;
}

/* Compute average cumulative curve across past years (full year) */
function averageYearCurve(runs) {
    const byYear = groupRunsByYear(runs);
    const pastYears = Object.keys(byYear).map(y => Number(y)).filter(y => y !== new Date().getFullYear());

    // Build cumulative for each past year
    const yearCurves = {};
    pastYears.forEach(year => {
        yearCurves[year] = cumulativeDistanceByDay(runs, year);
    });

    // Always use 365 or 366 days depending on year
    const maxDays = 366;
    const avgCurve = [];
    for (let i = 0; i < maxDays; i++) {
        let total = 0;
        let count = 0;
        pastYears.forEach(year => {
            if (yearCurves[year][i]) {
                total += yearCurves[year][i].cumulative;
                count++;
            }
        });
        avgCurve.push({ dayOfYear: i, cumulative: count > 0 ? total / count : 0 });
    }

    return avgCurve;
}

// Draw charts using cumulativeDistanceByDay
function drawCharts() {
    const runs = loadRuns();
    const currentYear = new Date().getFullYear();
    const cumCurrentYear = cumulativeDistanceByDay(runs, currentYear);

    // Build average year curve for full year
    const avgYearCurve = averageYearCurve(runs); // can modify averageYearCurve to output full year if needed

    // Graph 1: Current year vs average year
    const ctx1 = document.getElementById("graph-year-vs-average").getContext("2d");
    if(window.chart1) window.chart1.destroy();
    window.chart1 = new Chart(ctx1, {
        type: "line",
        data: {
            labels: cumCurrentYear.map(r => r.date),
            datasets: [
                {
                    label: `${currentYear}`,
                    data: cumCurrentYear.map(r => r.cumulative),
                    borderColor: "#007aff",
                    fill: false
                },
                {
                    label: "Average Year",
                    data: avgYearCurve.slice(0, cumCurrentYear.length).map(r => r.cumulative),
                    borderColor: "#ff9500",
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "bottom" }
            },
            scales: {
                x: {
                    display: false, // hide X-axis labels and grid
                    grid: { display: false }
                },
                y: {
                    display: true, // hide Y-axis labels and grid
                    grid: { display: false }
                }
            },
            elements: {
                point: { radius: 0 } // remove data point markers
            }
        }
    });

    // Graph 2: Current year vs past years individually
    const byYear = groupRunsByYear(runs);
    const datasets = Object.keys(byYear).map(y => {
        const cum = cumulativeDistanceByDay(runs, Number(y));
        return {
            label: y,
            data: cum.map(r => r.cumulative),
            borderColor: Number(y) === currentYear ? "#007aff" : "#999999",
            fill: false
        };
    });

    const ctx2 = document.getElementById("graph-year-vs-past").getContext("2d");
    if(window.chart2) window.chart2.destroy();
    window.chart2 = new Chart(ctx2, {
        type: "line",
        data: { labels: cumCurrentYear.map(r => r.date), datasets },
        options: {
            responsive: true,
            plugins: { legend: { position: "bottom" } },
            scales: {
                x: {
                    display: false, // hide X-axis labels and grid
                    grid: { display: false }
                },
                y: {
                    display: false, // hide Y-axis labels and grid
                    grid: { display: false }
                }
            },
            elements: {
                point: { radius: 0 } // remove data point markers
            }
        }
    });
}

// Redraw charts after adding a run
document.getElementById("add-run-confirm").addEventListener("click", ()=>{
    drawCharts();
});

// Initial draw
drawCharts();