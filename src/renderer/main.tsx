import { createRoot } from "react-dom/client";
import { CodeContourApp } from "./app.js";

const root = document.getElementById("root");

if (!root) throw new Error("Renderer root is unavailable");

createRoot(root).render(
  <CodeContourApp />,
);
