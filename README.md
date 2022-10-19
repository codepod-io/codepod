# CodePod: coding on a canvas, organized.

![screenshot](./screenshot.png)

# Development

Add a .env file to `./api/.env`, `./dev/.env` with the following:

```shell
POSTGRES_USER=YOUR_USERNAME
POSTGRES_PASSWORD=YOUR_PASSWORD
POSTGRES_DB=YOUR_DBNAME
JWT_SECRET=YOUR_SUPER_SECRET_KEY
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB?schema=public"
```

Then, start the DB service on localhost:5432

```
cd ./dev
docker compose up -d
```

If you haven't initialized the DB for the first time, do the initialization:

```
cd ./api
npx prisma migrate dev --name init
```

Start the API server on http://localhost:4000:

```
cd ./api
yarn dev
```

Start the UI server on http://localhost:3000:

```
cd ./ui
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
