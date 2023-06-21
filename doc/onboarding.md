
# Codepod Developer Onboarding Doc

## Developing Language

[Typescript](https://github.com/microsoft/TypeScript)

## Libraries and Frameworks
- [React](https://react.dev/) framework
	- [Apollo GraphQL](https://www.apollographql.com/)
	- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction) (scalable state management)
	- [Monaco](https://github.com/microsoft/monaco-editor) editor
	- [Remirror](https://github.com/remirror/remirror) rich-text editor
	- [Material](https://mui.com/core/) UI
	- [Nano ID](https://github.com/ai/nanoid/blob/HEAD/README.zh-CN.md) UUID generator
	- [Express](https://expressjs.com/)
- [Jupyter](https://jupyter-client.readthedocs.io/en/stable/messaging.html)
	- [ZeroMQ](https://github.com/zeromq/zeromq.js) Node.js bindings 
- [Docker](https://docs.docker.com/compose/compose-file/)
- [Kubernetes](https://kubernetes.io/docs/concepts/overview/)
	- [Helm](https://github.com/helm/helm) Chart 
- Proxy configuration: [NGINX](https://github.com/nginx/nginx)
- Database: [PostgreSQL](https://www.postgresql.org/) + [Prisma](https://github.com/prisma/prisma)

## Codepod System Architecture

## Codepod GitHub Repo

### Frontend
- [Ui](https://github.com/codepod-io/codepod/tree/main/ui): root folder for Codepod client implementation, it contains the implementation of pod, [Canvas](https://github.com/codepod-io/codepod/blob/main/ui/src/components/Canvas.tsx) and [Scope](https://github.com/codepod-io/codepod/blob/main/ui/src/components/nodes/Scope.tsx)

### Backend
- [Proxy](https://github.com/codepod-io/codepod/tree/main/proxy): reverse proxy server, it forwards/redirects client requests to proper servers in the backbone.
- [Api](https://github.com/codepod-io/codepod/tree/main/api): the API server handles users’ actions on the Codepod client app, it authenticates users, persists the repo, scope and pod states to the Postgres database. 
- [Runtime](https://github.com/codepod-io/codepod/tree/main/runtime): Codepod runtime server, http://localhost:4020, this URL is used in the front-end runtime.js to connect to the runtime, it handles the code execution logic on various kernels, e.g., IPython. 

### References
- A tutorial for React-based web application development, [WhatsApp-Clone-Tutorial](https://www.tortilla.academy/Urigo/WhatsApp-Clone-Tutorial/master/next/step/0)
- [Typescript Tutorial](https://github.com/xcatliu/typescript-tutorial) 