import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";

import './App.css';
import { RenderRouter } from "./pathfinder/route.registry";

export function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BrowserRouter>
        <RenderRouter />
      </BrowserRouter>
    </Suspense>
  );
}