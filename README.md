# CodePod: coding on a canvas, organized.

![screenshot](./screenshot.png)

# Development

```
cd ./compose/dev/
touch .env
```

Add your choice of secrets to the .env file (replace the placeholders):

```
POSTGRES_USER=<username>
POSTGRES_PASSWORD=<password>
POSTGRES_DB=<dbname>
JWT_SECRET=<yoursecret>
```

Start the docker-compose stack:

```
docker compose up -d
```

The docker-compose file declares a set of services:

- api: the backend API server
- ui: the frontend React app
- db: postgres DB
- prisma: prisma db viewer
- nginx: reverse proxy to use nice URLs

You will need to perform a manual installation of node_modules into the api and
ui containers. Attach a shell and run `yarn`. Without this, the initial api/ui
contianers will not run. So you likely need to make changes to docker compose to
do this (add `tty: true` and comment out commands line).

Then, initialize a DB by shell into the api container and run:

```
npx prisma migrate dev --name init
```

The nginx server expects `codepod.test` as the domain name. You can add a local
DNS record to your /etc/hosts:

```
10.43.1.148	codepod.test
```

This allows codepod.test to be resolved to your server machine. Then, go to

- http://codepod.test:3000 the web app
- http://codepod.test:3000/graphql the grpahql explorer
- http://codepod.test:5555 the prisma db viewer

# (TODO) Deployment

Build the docker images:

```
docker build -t lihebi/codepod-ui:v0.1.0 ./ui
docker build -t lihebi/codepod-api:v0.1.0 ./api
```

Push to registry:

```
docker push lihebi/codepod-ui:v0.1.0
docker push lihebi/codepod-api:v0.1.0
```

Create a cloud VM with docker support. Setup TLS, e.g., `app-v1.codepod.io`:

```
ufw allow 80
certbot certonly --standalone
```

Clone this repo on the cloud VM, and go to the production folder, change the
domain name to your DNS e.g., `app-v1.codepod.io`:

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

Start the docker-compose stack:

```
docker compose up -d
```

Then, initialize a DB by shell into the api container and run:

```
npx prisma migrate dev --name init
```

Now add DNS from domain name to the cloud server. Now go to

- http://codepod.test:3000 the web app
- http://codepod.test:3000/graphql the grpahql explorer
- http://codepod.test:5555 the prisma db viewer

# (TODO) Architecture
