# Deployment

Build the docker images:

```
docker build -t lihebi/codepod-ui:v0.4.3-alpha.3 ./ui
docker build -t lihebi/codepod-api:v0.4.3-alpha.3 ./api
docker build -t lihebi/codepod-proxy:v0.4.3-alpha.3 ./proxy
docker build -t lihebi/codepod-kernel-python:v0.4.3-alpha.3 ./runtime/kernel
docker build -t lihebi/codepod-runtime:v0.4.3-alpha.3 ./runtime
```

Push to registry:

```
docker push lihebi/codepod-ui:v0.4.3-alpha.3
docker push lihebi/codepod-api:v0.4.3-alpha.3
docker push lihebi/codepod-proxy:v0.4.3-alpha.3
docker push lihebi/codepod-kernel-python:v0.4.3-alpha.3
docker push lihebi/codepod-runtime:v0.4.3-alpha.3
```

Create a cloud VM with docker support. Add DNS from domain name to the cloud
server. Setup TLS, e.g., `app-v1.codepod.io`:

```
ufw allow 80
certbot certonly --standalone
```

Clone this repo on the cloud VM, and go to the production folder:

```
cd compose/prod
touch .env
```

Add your choice of secrets to the .env file (replace the placeholders):

```
POSTGRES_USER=<username>
POSTGRES_PASSWORD=<password>
POSTGRES_DB=<dbname>
JWT_SECRET=<yoursecret>
```

Change the domain name to your DNS in nginx.conf, e.g., `app-v1.codepod.io`:

Start the docker-compose stack:

```
docker compose up -d
```

Then, initialize a DB by shell into the api container and run:

```
npx prisma migrate dev --name init
```

Pull the kernel image:

```
docker pull lihebi/codepod-kernel-python:v0.4.3-alpha.3
docker tag lihebi/codepod-kernel-python:v0.4.3-alpha.3 codepod-kernel-python
```

Now go to

- https://app-v1.codepod.io the web app

# Cross platform build on M1

```
codepod % docker buildx build --platform=linux/amd64 -t test64 ./api
```
