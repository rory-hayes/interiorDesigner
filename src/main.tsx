import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installRoomPhotoFetchNormalizer } from "./lib/roomPhotoFetchNormalizer";
import "./styles.css";
import "./appShell.css";

installRoomPhotoFetchNormalizer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
