# CodePod runtime server

This folder contains the proxy server and runtime server.

## Development

First, spin up a ipython Jupyter kernel:

```
python3 -m ipykernel_launcher -f ./kernel/conn.json
```

Second, spin up the websocket server:

```
yarn devws
```

Now, the socket server is running at http://localhost:4020. This URL is used in
the front-end runtime.js to connect to the runtime.

## (TODO) proxy server

## (TODO) Deployment
