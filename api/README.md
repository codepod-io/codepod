# CodePod Repo Server

# Using Prisma and PostgreSQL

## Spin up the container

```
docker-compose up -d
```

This will create postgreSQL, listening on http://localhost:5432. The username and password is stored in .env. The template is copied here:

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=codepod123

GRAPHQL_SERVER_PORT=4000
GRAPHQL_SERVER_PATH=/graphql
GRAPHQL_SERVER_HOST=0.0.0.0

JWT_SECRET=

POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}?schema=public
```

## Prisma

Need to run migrate for the first time if the DB is not initialized on a new server.

migrate DB:

```
npx prisma migrate dev --name init
```

generate client (the migrate will run this, so no need anymore):

```
npx prisma generate
```

The studio can be viewed at

```
npx prisma studio
```

When I mess up with the database and want to start from scratch:

```
npx prisma db push --preview-feature
```


## Building node-pty

Install nvm and node, yarn as usual. Running of `yarn` may fail (to build
node-pty) due to missing development packages. On Ubuntu install:

```
sudo apt install -y make python build-essential
```