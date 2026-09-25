import { createRoot } from "react-dom/client";
import { AppShell } from "./app-shell.js";

const root = document.getElementById("root");

if (!root) throw new Error("Renderer root is unavailable");

createRoot(root).render(
  <AppShell activeScreen="project-hub" project={null}>
    <section>
      <h1>Project Hub</h1>
      <p>Select or create a local project to begin.</p>
    </section>
  </AppShell>,
);
