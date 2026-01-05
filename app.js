let runs = JSON.parse(localStorage.getItem("runs")) || [];

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
}

function addRun() {
    const date = dateInput.value;
    const distance = parseFloat(distanceInput.value);
    const time = parseFloat(timeInput.value);

    if (!date || !distance || !time) return;

    runs.push({ date, distance, time });
    localStorage.setItem("runs", JSON.stringify(runs));

    render();
}

function render() {
    const runsDiv = document.getElementById("runs");
    runsDiv.innerHTML = "";

    let total = 0;

    runs.forEach(run => {
        total += run.distance;

        const div = document.createElement("div");
        div.className = "run";
        div.innerText = `${run.date} – ${run.distance} km in ${run.time} min`;
        runsDiv.appendChild(div);
    });

    document.getElementById("totalDistance").innerText = total.toFixed(1);
}

render();

