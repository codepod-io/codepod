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


## Pull the docker images 

- TODO automatically pull the images?
- TODO use a more generic image tag here, e.g. latest

```

docker pull lihebi/codepod-kernel-python
docker pull lihebi/codepod-runtime
```

## Configuration and starting the services

First, create a `dev/.env` file with the following content (leave as is or change the value to
whatever you want):

```
POSTGRES_USER=myusername
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=mydbname
JWT_SECRET=mysupersecretjwttoken
```

Then, modify the `nginx.conf` and change the `server_name` field to your choices.
For example, if you are running on localhost, you can use:

```
server_name prisma.127.0.0.1.sslip.io;
```

Then, start the stack:

```
cd dev
docker compose up -d
```

If this is your first time running it, the database is empty, and you need to
initialize the database. To do that, shell into the API container 

```shell
docker exec -it dev-api-1 bash
```

and run

```
npx prisma migrate dev --name init
```

Wait a few minutes for packages installation and compilation. Once `ui` and
`api` containers are ready listening on http ports, go to the DNS name you set
above, e.g. `http://codepod.127.0.0.1.sslip.io`, and you should see the web app UI.
Additional tools:

- `http://web.127.0.0.1.sslip.io/graphql`: Apollo GraphQL explorer for the backend APIs
- `http://prisma.127.0.0.1.sslip.io`: Prisma Studio for viewing and debugging the database.
