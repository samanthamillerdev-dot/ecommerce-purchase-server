import { ClickUIProvider } from "@clickhouse/click-ui";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClickUIProvider theme="light">
      <App />
    </ClickUIProvider>
  </React.StrictMode>
);
