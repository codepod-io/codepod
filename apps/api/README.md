# CP Kernel

This is a package designed for code sharing between the codepod API and the electron server.

To use the kernel:
If you use `yarn`, you can run `yarn add link:/path/to/cpkernel`. However, this will not work with npm. For `npm`, you need to run `npm link` in cpkernel folder to register the package globally, and run `npm link cpkernel` to link. This won't reflect in package.json.

Thus the ideal setup should be to add cpkernel to package.json, but not to install it. Instead, run `npm link cpkernel` during development.

# CodePod Repo Server

# Using Prisma and PostgreSQL

## Spin up the container

```bash
docker-compose up -d
```

This will create postgreSQL, listening on [http://localhost:5432](http://localhost:5432). The username and password is stored in the `.env` file. The template is copied here:

```properties
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

```bash
npx prisma migrate dev --name init
```

create another migration with just a different name:

```bash
prisma migrate dev --name added_job_title
```

generate client (the migrate will run this, so no need anymore. But do not
forget to do this after changing the schema, otherwise you'll end up with debugging
strange errors):

```bash
npx prisma generate
```

The studio can be viewed at

```bash
npx prisma studio
```

When I mess up with the database and want to start from scratch:

```bash
npx prisma db push --preview-feature
```

## Building node-pty

Install nvm and node, yarn as usual. Though running `yarn` may fail (to build
node-pty) due to missing development packages. On Ubuntu, fixing it by running:

```bash
sudo apt install -y make python build-essential
```
