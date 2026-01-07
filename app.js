// --- Burger menu and year exclusion logic ---
// Burger menu
const burgerBtn = document.getElementById("burger-menu-btn");
const burgerMenu = document.getElementById("burger-menu");
if (burgerBtn && burgerMenu) {
    burgerBtn.addEventListener("click", () => {
        burgerMenu.classList.toggle("open");
    });
}

// Year exclusion state
let excludedYears = new Set();

function getAllYears() {
    const runs = loadRuns();
    const years = new Set();
    runs.forEach(run => {
        years.add(new Date(run.date).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
}

function renderYearButtons() {
    const container = document.getElementById("year-exclude-container");
    if (!container) return;
    container.innerHTML = "";
    const years = getAllYears();
    years.forEach(year => {
        const btn = document.createElement("button");
        btn.textContent = year;
        btn.className = "year-btn";
        if (excludedYears.has(year)) btn.classList.add("excluded");
        btn.addEventListener("click", () => {
            if (excludedYears.has(year)) excludedYears.delete(year);
            else excludedYears.add(year);
            renderYearButtons();
            drawCharts();
            updateStatsCalculations();
        });
        container.appendChild(btn);
    });
}

// Call this after runs are added/imported
function updateYearButtons() {
    renderYearButtons();
}

// Filtered runs loader
function loadRunsFiltered() {
    const runs = loadRuns();
    if (!excludedYears.size) return runs;
    return runs.filter(run => !excludedYears.has(new Date(run.date).getFullYear()));
}
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
    // Use filtered runs
    runs = runs || loadRunsFiltered();
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
    runs = runs || loadRunsFiltered();
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

/*
 Find comparable day in average year:
 The latest day where avg-year cumulative <= current year's cumulative today
 Returns an object: { dayIndex, dateLabel, cumulative }
*/
function comparableDayInAverageYear(runs) {
    runs = runs || loadRunsFiltered();
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayStr = today.toISOString().slice(0, 10);
    // Current year cumulative today
    const currentCurve = cumulativeDistanceByDay(runs, currentYear);
    const currentToday = currentCurve.find(d => d.date === todayStr);
    if (!currentToday) return null;
    const currentCum = currentToday.cumulative;
    // Average year curve
    const avgCurve = averageYearCurve(runs);
    // Find last day where avg cumulative <= current cumulative
    let comparableIndex = 0;
    for (let i = 0; i < avgCurve.length; i++) {
        if (avgCurve[i].cumulative <= currentCum) {
            comparableIndex = i;
        } else {
            break;
        }
    }
    // Convert day index to readable date (using non-leap reference year)
    const refYear = 2001; // non-leap year
    const date = new Date(refYear, 0, 1);
    date.setDate(date.getDate() + comparableIndex);
    return {
        dayIndex: comparableIndex,
        dateLabel: date.toISOString().slice(5, 10), // MM-DD
        cumulative: avgCurve[comparableIndex].cumulative
    };
}

/*
 Calculate days ahead / behind compared to average year
 Positive = ahead, Negative = behind
*/
function daysAheadBehindAverage(runs) {
    runs = runs || loadRunsFiltered();
    const today = new Date();
    const dayOfYear =
        Math.floor((today - new Date(today.getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24));
    const comparable = comparableDayInAverageYear(runs);
    if (!comparable) return 0;
    return comparable.dayIndex - dayOfYear;
}

// Draw charts using cumulativeDistanceByDay
function drawCharts() {
    const runs = loadRunsFiltered();
    const currentYear = new Date().getFullYear();
    const cumCurrentYear = cumulativeDistanceByDay(runs, currentYear);
    // Build average year curve for full year
    const avgYearCurve = averageYearCurve(runs);
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
                    display: false,
                    grid: { display: false }
                },
                y: {
                    display: true,
                    grid: { display: false }
                }
            },
            elements: {
                point: { radius: 0 }
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
                    display: false,
                    grid: { display: false }
                },
                y: {
                    display: true,
                    grid: { display: false }
                }
            },
            elements: {
                point: { radius: 0 }
            }
        }
    });
}

/* Calculate difference to date: current year's cumulative today minus average cumulative of past years today */
function differenceToDate(runs) {
    runs = runs || loadRunsFiltered();
    const today = new Date();
    const currentYear = today.getFullYear();
    const dayStr = today.toISOString().slice(0,10);
    const cumCurrent = cumulativeDistanceByDay(runs, currentYear).find(r => r.date === dayStr);
    const byYear = groupRunsByYear(runs);
    const pastYears = Object.keys(byYear).map(y => Number(y)).filter(y => y !== currentYear);
    if (!cumCurrent) return 0;
    // compute cumulative of past years for same day
    const pastCumulatives = pastYears.map(y => {
        const cumArray = cumulativeDistanceByDay(runs, y);
        const found = cumArray.find(r => r.date.slice(5) === dayStr.slice(5));
        return found ? found.cumulative : 0;
    });
    const avgPast = pastCumulatives.length ? pastCumulatives.reduce((a,b)=>a+b,0)/pastCumulatives.length : 0;
    return cumCurrent.cumulative - avgPast;
}

/* Generic function for difference to target average per day */
function differenceToTarget(runs, targetTotal) {
    runs = runs || loadRunsFiltered();
    const today = new Date();
    const currentYear = today.getFullYear();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(),0,1))/(1000*60*60*24)) + 1;
    const cumCurrent = cumulativeDistanceByDay(runs, currentYear).find(r => r.date === today.toISOString().slice(0,10));
    if (!cumCurrent) return 0;
    // evenly distributed daily target
    const targetPerDay = targetTotal / 365;
    return cumCurrent.cumulative - (targetPerDay * dayOfYear);
}

/* Example wrappers for previous averages or custom numbers */
function differenceToAverage(runs) {
    runs = runs || loadRunsFiltered();
    const byYear = groupRunsByYear(runs);
    const currentYear = new Date().getFullYear();
    const pastYears = Object.keys(byYear).map(y => Number(y)).filter(y => y !== currentYear);
    // compute average total distance of past years
    const totalPast = pastYears.map(y => {
        const cumArray = cumulativeDistanceByDay(runs, y);
        return cumArray.length ? cumArray[cumArray.length-1].cumulative : 0;
    });
    const avgTotal = totalPast.length ? totalPast.reduce((a,b)=>a+b,0)/totalPast.length : 0;
    return differenceToTarget(runs, avgTotal);
}

/*
 Difference to scaled average year:
 today cumulative − (avg-year cumulative today × target / avg-year total)
*/
function differenceToScaledAverage(runs, targetTotal) {
    runs = runs || loadRunsFiltered();
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayStr = today.toISOString().slice(0, 10);
    // Current year cumulative today
    const currentCurve = cumulativeDistanceByDay(runs, currentYear);
    const currentToday = currentCurve.find(d => d.date === todayStr);
    if (!currentToday) return 0;
    const byYear = groupRunsByYear(runs);
    const pastYears = Object.keys(byYear)
        .map(Number)
        .filter(y => y !== currentYear);
    if (pastYears.length === 0) return 0;
    let sumCumToday = 0;
    let sumYearTotal = 0;
    let count = 0;
    pastYears.forEach(year => {
        const curve = cumulativeDistanceByDay(runs, year);
        const todayLike = curve.find(d => d.date.slice(5) === todayStr.slice(5));
        const yearTotal = curve[curve.length - 1]?.cumulative ?? 0;
        if (yearTotal > 0 && todayLike) {
            sumCumToday += todayLike.cumulative;
            sumYearTotal += yearTotal;
            count++;
        }
    });
    if (count === 0) return 0;
    const avgCumToday = sumCumToday / count;
    const avgYearTotal = sumYearTotal / count;
    const scaledExpected = avgCumToday * (targetTotal / avgYearTotal);
    return currentToday.cumulative - scaledExpected;
}

function differenceToScaled1800(runs) {
    return differenceToScaledAverage(runs, 1800);
}

function differenceToScaled2100(runs) {
    return differenceToScaledAverage(runs, 2100);
}

/* Example custom targets */
function differenceTo1800(runs) {
    return differenceToTarget(runs, 1800);
}

function differenceTo2100(runs) {
    return differenceToTarget(runs, 2100);
}

// --- Year-end prediction calculations ---
// Helper: context for today
function getTodayContext(runs) {
    runs = runs || loadRunsFiltered();
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayStr = today.toISOString().slice(0, 10);
    const dayOfYear =
        Math.floor((today - new Date(currentYear, 0, 1)) / (1000 * 60 * 60 * 24)) + 1;
    // Current year cumulative today
    const currentCurve = cumulativeDistanceByDay(runs, currentYear);
    const currentToday = currentCurve.find(d => d.date === todayStr);
    if (!currentToday) return null;
    // Average year cumulative
    const avgCurve = averageYearCurve(runs);
    const avgToday = avgCurve[dayOfYear - 1]?.cumulative ?? 0;
    // Average year total (Dec 31)
    const avgTotal = avgCurve[avgCurve.length - 1]?.cumulative ?? 0;
    return {
        dayOfYear,
        currentCum: currentToday.cumulative,
        avgCumToday: avgToday,
        avgTotal
    };
}

// Step 1: current cum vs average year (current / average-to-date)
function distRatio(runs) {
    const ctx = getTodayContext(runs || loadRunsFiltered());
    if (!ctx || ctx.avgCumToday === 0) return 0;
    return ctx.currentCum / ctx.avgCumToday;
}

// Step 2: prediction multiplier
function predictionMultiplier(runs) {
    const ctx = getTodayContext(runs || loadRunsFiltered());
    if (!ctx) return 1;
    const ratio = distRatio(runs);
    const progressFactor = Math.pow(ctx.dayOfYear / 365, 0.5);
    return 1 + progressFactor * ratio;
}

// Step 3: predicted total distance for the year
function predictedYearTotal(runs) {
    const ctx = getTodayContext(runs || loadRunsFiltered());
    if (!ctx) return 0;
    const multiplier = predictionMultiplier(runs);
    return ctx.avgTotal * multiplier;
}



// --- Stats Calculation UI population ---
function updateStatsCalculations() {
    const runs = loadRunsFiltered();
    const diffToDate = differenceToDate(runs);
    const diffToAvg = differenceToAverage(runs);
    const diff1800 = differenceTo1800(runs);
    const diff2100 = differenceTo2100(runs);
    const diffScaled1800 = differenceToScaled1800(runs);
    const diffScaled2100 = differenceToScaled2100(runs);
    const daysAheadBehind = daysAheadBehindAverage(runs);
    const predict = predictedYearTotal(runs);
    const gain = distRatio(runs);
    const multiplier = predictionMultiplier(runs);
    const elemDate = document.getElementById("calc-difference-to-date");
    const elemAvg = document.getElementById("calc-difference-to-average");
    const elem1800 = document.getElementById("calc-difference-1800");
    const elem2100 = document.getElementById("calc-difference-2100");
    const elemScaled1800 = document.getElementById("calc-difference-scaled-1800");
    const elemScaled2100 = document.getElementById("calc-difference-scaled-2100");
    const elemDays = document.getElementById("calc-days-ahead-behind");
    const elemPredict = document.getElementById("calc-predict");
    const elemGain = document.getElementById("calc-gain");
    const elemMultiplier = document.getElementById("calc-multiplier");
    if (elemDate) elemDate.innerText = diffToDate.toFixed(1);
    if (elemAvg) elemAvg.innerText = diffToAvg.toFixed(1);
    if (elem1800) elem1800.innerText = diff1800.toFixed(1);
    if (elem2100) elem2100.innerText = diff2100.toFixed(1);
    if (elemScaled1800) elemScaled1800.innerText = diffScaled1800.toFixed(1);
    if (elemScaled2100) elemScaled2100.innerText = diffScaled2100.toFixed(1);
    if (elemDays) elemDays.innerText = daysAheadBehind;
    if (elemPredict) elemPredict.innerText = predict.toFixed(1);
    if (elemGain) elemGain.innerText = gain.toFixed(1);
    if (elemMultiplier) elemMultiplier.innerText = multiplier.toFixed(1);
}

// Call after drawing charts
drawCharts();
updateStatsCalculations();
updateYearButtons && updateYearButtons();

// Also update after adding a run
document.getElementById("add-run-confirm").addEventListener("click", ()=>{
    drawCharts();
    updateStatsCalculations();
    updateYearButtons && updateYearButtons();
});

// --- Strava OAuth (Netlify-backed, Authorization Code flow) ---
const STRAVA_CLIENT_ID = 194050;
const STRAVA_SCOPE = "activity:read_all";
const STRAVA_REDIRECT_URI =
    "https://sports-app-jonaswoetmann.netlify.app/.netlify/functions/strava-callback";

// Launch Strava OAuth
const stravaBtn = document.getElementById("connect-strava");
if (stravaBtn) {
    stravaBtn.addEventListener("click", () => {
        const authUrl =
            "https://www.strava.com/oauth/authorize" +
            `?client_id=${STRAVA_CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}` +
            `&response_type=code` +
            `&scope=${STRAVA_SCOPE}` +
            `&approval_prompt=auto`;

        window.location.href = authUrl;
    });
}

// Extract access token injected by Netlify redirect (#access_token=...)
function getAccessTokenFromUrl() {
    const hash = window.location.hash;
    if (!hash) return null;
    const params = new URLSearchParams(hash.substring(1));
    return params.get("access_token");
}

// Fetch Strava runs
async function fetchStravaRuns(accessToken) {
    let allRuns = [];
    let page = 1;
    const perPage = 50;

    while (true) {
        const res = await fetch(
            `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        if (!res.ok) break;

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;

        data.forEach(activity => {
            if (activity.type === "Run") {
                allRuns.push({
                    id: `strava_${activity.id}`,
                    date: activity.start_date.slice(0, 10),
                    distanceKm: activity.distance / 1000,
                    durationSec: activity.moving_time,
                    source: "strava"
                });
            }
        });

        page++;
    }

    return allRuns;
}

// Import Strava runs (deduplicated)
async function importStravaRuns() {
    const token = getAccessTokenFromUrl();
    if (!token) return;

    const existingRuns = loadRuns();
    const existingIds = new Set(existingRuns.map(r => r.id));

    const stravaRuns = await fetchStravaRuns(token);
    const newRuns = stravaRuns.filter(r => !existingIds.has(r.id));

    newRuns.forEach(run => addRun(run));

    drawCharts();
    updateStatsCalculations();
    updateYearButtons && updateYearButtons();
    console.log(`Imported ${newRuns.length} new Strava runs`);
    // Clean URL
    history.replaceState(null, "", window.location.pathname);
}

// On page load, check for Strava token
window.addEventListener("load", () => {
    if (window.location.hash.includes("access_token")) {
        importStravaRuns();
    }
    updateYearButtons && updateYearButtons();
});