# CodePod: coding on a canvas, organized.

![screenshot](./screenshot.png)

# Development

## Setup DB credentials

Add a .env file to `./api/.env`, `./dev/.env` with the following credentials:

```shell
POSTGRES_USER=YOUR_USERNAME
POSTGRES_PASSWORD=YOUR_PASSWORD
POSTGRES_DB=YOUR_DBNAME
JWT_SECRET=YOUR_SUPER_SECRET_KEY
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB?schema=public"
```

- `dev/.env` is used to setup the DB with correct credentials
- `api/.env` is used by the backend API to talk to the DB.

## Setup DB

Note: to avoid installing docker on your local machine, you could launch the DB
service on a remote Linux server. You'll need to change the DATABASE_URL in the .env files.

To start the DB service on localhost:5432, install docker and run:

```
cd dev
docker compose up -d
```

If you haven't initialized the DB for the first time, do the initialization:

```shell
cd api
npx prisma migrate dev --name init
```

You might also need to generate the prisma client (the above command will generate the client. You only need this if you are using a remote DB):

```shell
cd api
npx prisma generate
```

## Start the app

Start the API server on http://localhost:4000:

```shell
cd api
yarn # install deps
yarn dev
```

Start the UI server on http://localhost:3000:

```shell
cd ui
yarn # install deps
yarn dev
```

Now you should be able to see the app running on http://localhost:3000.

Configuration:

- `ui/src/lib/vars.js`: this file defines the api URL, default for http://localhost:4000.

## Additional tools

The graphql debugger is at http://localhost:3000/graphql.

There's also a prisma DB viewer, you can start it by:

```
cd api
npx prisma studio
```

By default it is at http://localhost:5555

Storybook is a tool for easier development of React components. You can start it on http://localhost:5555 by:

```
cd ui
yarn storybook
```
