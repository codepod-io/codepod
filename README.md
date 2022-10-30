# CodePod: coding on a canvas, organized.

![screenshot](./screenshot.png)

# Development

The development environment is managed in docker compose file, because we have many components talking to each other. The up-to-date compose file is `./compose/dev2/compose.yml`.

First, create a file `./compose/dev2/.env` to setup DB credentials with your choice of values:

```shell
POSTGRES_USER=<YOUR_USERNAME>
POSTGRES_PASSWORD=<YOUR_PASSWORD>
POSTGRES_DB=<YOUR_DBNAME>
JWT_SECRET=<YOUR_SUPER_SECRET_KEY>
```

Then, we need to run `docker compose up -d` to start the stack. But before that,
we need to install the node packages for the ui/api/proxy containers. To do
that, modify the command and tty like this:

```
api:
    # ...
    command: yarn
    tty: true
ui:
    # ...
    command: yarn
    tty: true
proxy:
    # ...
    command: yarn
    tty: true
```

Then run:

```
docker compose up -d
```

Now the node_modules are installed for the containers. Then **revert** those modifications, and run again:

```
docker compose up -d
```

One last thing: initialize the DB: Attach a terminal to the `api` container and run:

```
npx prisma migrate dev --name init
```

Now you are all set. Go to

- http://localhost:3000: the UI of the web app
- http://localhost:4000/graphql: the app API server
- http://localhost:5555: the prisma DB viewer

# Runtime spawners

The API server needs to spawn runtime containers. There are two images (configured in the docker-compose file):

```
docker build -t lihebi/codepod_kernel_python:v0.1.0 ./runtime/kernel
docker build -t lihebi/codepod_runtime:v0.0.1 ./runtime
```
