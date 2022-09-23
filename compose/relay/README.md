# Setting up relay server

A relay server is a thin public server on cloud provider, which routes traffic back to another server (probably under tailscale without public IP).

Modify the IP in nginx.conf and setup this relay stack on the public server.

On the real server machine, start up the stack.
