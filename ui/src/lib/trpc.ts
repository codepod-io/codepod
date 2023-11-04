import {
  createTRPCReact,
  createTRPCProxyClient,
  httpBatchLink,
} from "@trpc/react-query";
import type { AppRouter } from "../../../api/src/spawner/trpc";
export const trpc = createTRPCReact<AppRouter>();
let remoteUrl;

if (import.meta.env.DEV) {
  remoteUrl = `localhost:4000`;
} else {
  remoteUrl = `${window.location.hostname}:${window.location.port}`;
}
export const trpcProxyClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `http://${remoteUrl}/trpc`,
    }),
  ],
});
