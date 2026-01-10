import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Global error handlers to prevent app crashes
window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);
    // Prevent default error handling that might crash the app
    event.preventDefault();
});

window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    // Prevent default error handling that might crash the app
    event.preventDefault();
});

const rootElement = document.getElementById("root");

if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <HashRouter>
                <App />
            </HashRouter>
        </React.StrictMode>
    );
}
