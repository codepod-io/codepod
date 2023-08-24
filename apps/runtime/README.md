# CodePod runtime server

This folder contains the proxy server and runtime server.

## Development

1. Spin up an ipython Jupyter kernel:

	```bash
	python3 -m ipykernel_launcher -f ./kernel/conn.json
	```

2. Spin up the websocket server:

	```bash
	yarn devws
	```

Now, the socket server is running at [http://localhost:4020](http://localhost:4020). This URL is used in
the front-end runtime.js to connect to the runtime.

## (TODO) proxy server

## (TODO) Deployment
