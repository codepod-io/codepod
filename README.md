# CodePod: coding on a canvas, organized.

![screenshot](./screenshot.png)

# Developing CodePod using docker-compose

The docker compose files are in `compose/` folder. There are two stacks:

- The `dev` stack mounts the `src` folder, so that you can edit the files on
  your local computer, and let the node.js process inside the container do the
  compiling and hot-reloading.
- The `prod` stack builds the images instead of mounting `src` folders, for the
  purpose of testing image builds.

To install docker-compose, follow [this official instruction](https://docs.docker.com/compose/install/linux/).

## Configuration and starting the services

First, create a `dev/.env` file with the following content (leave as is or change the value to
whatever you want):

```
POSTGRES_USER=myusername
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=mydbname
JWT_SECRET=mysupersecretjwttoken
REACT_APP_GOOGLE_CLIENT_ID=<google oauth client id>
```

Start the stack:

```
cd dev
docker compose up -d
```

Wait a few minutes for packages installation and compilation. Once `ui` and
`api` containers are ready listening on http ports, go to `http://localhost:80`
to see the app.

- `http://localhost:80/graphql`: Apollo GraphQL explorer for the backend APIs
- `http://prisma.127.0.0.1.sslip.io`: Prisma Studio for viewing and debugging the database.

## Initialize the database

If this is your first time running it, the database is empty, and you need to
initialize the database. To do that, open a shell into the API container and run:

```
npx prisma migrate dev
```
