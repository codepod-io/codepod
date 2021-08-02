# Production

1. create VM on GCP, via terraform
2. install frps on that VM
3. connect frpc from this local server
4. obtain letsencrypt keys
5. start the production build. The production build contains a nginx to handle
   TLS, and forward to internal ports.
