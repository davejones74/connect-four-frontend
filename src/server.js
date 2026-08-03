const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api", async (req, res) => {
    const body = ["POST", "PUT", "PATCH"].includes(req.method)
        ? JSON.stringify(req.body ?? {})
        : undefined;
    try {
        const response = await fetch(BACKEND_URL + req.originalUrl, {
            method: req.method,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body
        });
        const text = await response.text();
        res.status(response.status);
        if (response.headers.get("content-type")) {
            res.set("Content-Type", response.headers.get("content-type"));
        }
        res.send(text);
    } catch (err) {
        res.status(502).json({ message: `Backend unavailable at ${BACKEND_URL}: ${err.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Proxying /api requests to ${BACKEND_URL}`);
});
