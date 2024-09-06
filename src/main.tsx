import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Define global for browser environment
window.global = window;

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
} else {
  console.error("Root element not found");
}
