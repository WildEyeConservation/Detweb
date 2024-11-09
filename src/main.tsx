import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Progress } from "./UserContext";
import { GlobalContextProvider } from "./Context";
import ScratchPad from "./ScratchPad";
import ProjectManagement from "./ProjectManagement";
import UserStats from "./UserStats";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import ErrorPage from "./error-page";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

// Define global for browser environment
window.global = window;
let Annotate = ScratchPad();

const router = createBrowserRouter([
  {
    path: "/:projectId?",
    element:
    <GlobalContextProvider>
    <Progress>
    <QueryClientProvider client={queryClient}>
    <ReactQueryDevtools initialIsOpen={false} />
    <App />
    </QueryClientProvider>
    </Progress>
      </GlobalContextProvider>,  
    errorElement: <ErrorPage />,
    children: [
      {
        path: "annotate",
        element: <Annotate />
      },
      {
        path: "projectManagement",
        element: <ProjectManagement />
      },
      {
        path: "leaderboard",
        element: <UserStats />
      }
    ]
  },
]);

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
    <RouterProvider router={router} />
    </React.StrictMode>
  );
} else {
  console.error("Root element not found");
}
