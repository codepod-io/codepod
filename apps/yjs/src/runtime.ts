// chooes between docker and k8s spawners
import {
  spawnRuntime as spawnRuntime_docker,
  killRuntime as killRuntime_docker,
  infoRuntime as infoRuntime_docker,
  loopKillInactiveRoutes as loopKillInactiveRoutes_docker,
  initRoutes as initRoutes_docker,
} from "./spawner-docker";
import {
  spawnRuntime as spawnRuntime_k8s,
  killRuntime as killRuntime_k8s,
  infoRuntime as infoRuntime_k8s,
  loopKillInactiveRoutes as loopKillInactiveRoutes_k8s,
  initRoutes as initRoutes_k8s,
} from "./spawner-k8s";

export const spawnRuntime =
  process.env.RUNTIME_SPAWNER === "k8s"
    ? spawnRuntime_k8s
    : spawnRuntime_docker;
export const killRuntime =
  process.env.RUNTIME_SPAWNER === "k8s" ? killRuntime_k8s : killRuntime_docker;

export const initRoutes =
  process.env.RUNTIME_SPAWNER !== "k8s" ? initRoutes_docker : initRoutes_k8s;
export const loopKillInactiveRoutes =
  process.env.RUNTIME_SPAWNER !== "k8s"
    ? loopKillInactiveRoutes_docker
    : loopKillInactiveRoutes_k8s;
