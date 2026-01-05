self.addEventListener("install", e => {
    e.waitUntil(
        caches.open("runlog").then(cache =>
            cache.addAll([
                "./",
                "./index.html",
                "./style.css",
                "./app.js"
            ])
        )
    );
});