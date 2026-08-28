import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

const rawBase = import.meta.env.BASE_URL || "/";
const basepath = rawBase === "/" ? "/" : rawBase.replace(/\/$/, "");

export function getRouter() {
  return createRouter({
    routeTree,
    basepath,
    defaultErrorComponent: AppErrorComponent,
  });
}