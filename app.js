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

// Cumulative distance for a specific year
function cumulativeDistanceForYear(runs, year) {
    const yearRuns = runs.filter(r => new Date(r.date).getFullYear() === Number(year));
    const sorted = sortRunsByDate(yearRuns);
    const cum = [];
    let total = 0;
    sorted.forEach(run => {
        total += run.distanceKm;
        cum.push({ date: run.date, cumulative: total });
    });
    return cum;
}

// Average year curve
function averageYearCurve(runs) {
    const byYear = groupRunsByYear(runs);
    const dayTotals = {};
    Object.keys(byYear).forEach(y => {
        byYear[y].forEach(run => {
            const date = new Date(run.date);
            const start = new Date(date.getFullYear(), 0, 1);
            const dayOfYear = Math.floor((date - start)/(1000*60*60*24));
            if (!dayTotals[dayOfYear]) dayTotals[dayOfYear] = [];
            dayTotals[dayOfYear].push(run.distanceKm);
        });
    });
    const avgCurve = [];
    let runningTotal = 0;
    const maxDay = 365;
    for (let i=0;i<=maxDay;i++){
        if(dayTotals[i]){
            const avg = dayTotals[i].reduce((a,b)=>a+b,0)/dayTotals[i].length;
            runningTotal += avg;
        }
        avgCurve.push({ dayOfYear:i, cumulative: runningTotal });
    }
    return avgCurve;
}

// Draw charts
function drawCharts() {
    const runs = loadRuns();
    const currentYear = new Date().getFullYear();
    const cumCurrentYear = cumulativeDistanceForYear(runs, currentYear);
    const avgYear = averageYearCurve(runs);

    // Graph 1: current year vs average
    const ctx1 = document.getElementById("graph-year-vs-average").getContext("2d");
    if(window.chart1) window.chart1.destroy();
    window.chart1 = new Chart(ctx1, {
        type: "line",
        data: {
            labels: cumCurrentYear.map(r=>r.date),
            datasets: [
                {
                    label: `Current Year (${currentYear})`,
                    data: cumCurrentYear.map(r=>r.cumulative),
                    borderColor: "#007aff",
                    fill: false
                },
                {
                    label: "Average Year",
                    data: avgYear.slice(0,cumCurrentYear.length).map(r=>r.cumulative),
                    borderColor: "#ff9500",
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend:{ position: "bottom" } },
            scales: {
                x: { display:true, title:{ display:true, text:"Date" } },
                y: { display:true, title:{ display:true, text:"Cumulative Distance (km)" } }
            }
        }
    });

    // Graph 2: current year vs past years individually
    const byYear = groupRunsByYear(runs);
    const datasets = Object.keys(byYear).map(y=>{
        const cum = cumulativeDistanceForYear(runs, y);
        return {
            label: y,
            data: cum.map(r=>r.cumulative),
            borderColor: Number(y)===currentYear?"#007aff": "#999999",
            fill:false
        };
    });

    const ctx2 = document.getElementById("graph-year-vs-past").getContext("2d");
    if(window.chart2) window.chart2.destroy();
    window.chart2 = new Chart(ctx2, {
        type:"line",
        data:{ labels:cumCurrentYear.map(r=>r.date), datasets},
        options:{
            responsive:true,
            plugins:{legend:{ position:"bottom" }},
            scales:{
                x:{ display:true, title:{ display:true, text:"Date" }},
                y:{ display:true, title:{ display:true, text:"Cumulative Distance (km)" }}
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