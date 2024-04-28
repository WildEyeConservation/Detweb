import "./init";
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "mdb-react-ui-kit/dist/css/mdb.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import App from "./App";
import { AuthProvider } from "./AuthContext";
//import * as serviceWorker from './serviceWorker';

const root = createRoot(document.getElementById("root")); // createRoot(container!) if you use TypeScript
root.render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
//serviceWorker.unregister();
