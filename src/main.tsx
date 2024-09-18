import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'
Amplify.configure(outputs)
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Global , Progress } from "./UserContext";
import { generateClient } from "aws-amplify/api";
import { Schema } from '../amplify/data/resource';
import {
  BrowserRouter as Router,
} from "react-router-dom";

export const client = generateClient<Schema>({ authMode: "userPool" });

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

// Define global for browser environment
window.global = window;

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    //<React.StrictMode>
      <Router>
      <Global>
        <Progress>
      <QueryClientProvider client={queryClient}>
      <ReactQueryDevtools initialIsOpen={false} />
      <App />
          </QueryClientProvider>
          </Progress>
      </Global>  
      </Router>

      //</React.StrictMode>
  );
} else {
  console.error("Root element not found");
}
