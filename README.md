# CodePod: coding on a canvas, organized.

Codepod provides the interactive coding experience popularized by Jupyter, but
with scalability and production-readiness. Users can still incrementally build
up code by trying out a small code snippet each time. But they would not be
overwhelmed by the great number of code snippets as the projects grow. 

<div align="center"><h2>Try it online at <a href="https://app.codepod.io">https://app.codepod.io!</a></a></div>

![screenshot](./screenshot-canvas.png)

# Contributing

CodePod is open source under MIT license. Feel free to contribute! We can make
it better together. You can contribute by opening an issue, discussion, or
submitting a pull request. Do use [Prettier](https://prettier.io/) (e.g., [its
VSCode
plugin](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode))
to format your code before checking in.

# Citation

https://arxiv.org/abs/2301.02410

```
@misc{https://doi.org/10.48550/arxiv.2301.02410,
  doi = {10.48550/ARXIV.2301.02410},
  url = {https://arxiv.org/abs/2301.02410},
  author = {Li, Hebi and Bao, Forrest Sheng and Xiao, Qi and Tian, Jin},
  title = {Codepod: A Namespace-Aware, Hierarchical Jupyter for Interactive Development at Scale},
  publisher = {arXiv},
  year = {2023},
  copyright = {Creative Commons Attribution 4.0 International}
}
```

# Developing CodePod using docker-compose

The docker compose files are in `compose/dev` folder. The `dev` stack mounts the
`src` folder, so that you can edit the files on your local computer, and let the
node.js process inside the container do the compiling and hot-reloading.

To install docker-compose, follow the official [Docker documentation](https://docs.docker.com/compose/install/linux/).

First, create a `dev/.env` file with the following content (leave as is or change the value to
whatever you want). Leave the `GOOGLE_CLIENT_ID` empty if you do not need the OAuth provided by Google.

```properties
POSTGRES_USER=myusername
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=mydbname
JWT_SECRET=mysupersecretjwttoken
GOOGLE_CLIENT_ID=<google oauth client id>
```

Start the stack:

```bash
cd dev
docker compose up -d
```

You need to initialized the database first before starting the stack. See below.

Wait a few minutes for the package installation and compilation. Once the `ui` and
`api` containers are ready, go to `http://localhost:80` to see the app.

- `http://localhost:80/graphql`: Apollo GraphQL explorer for the backend APIs
- `http://prisma.127.0.0.1.sslip.io`: Prisma Studio for viewing and debugging the database.

## Initialize the database

If this is your first time running it, you would need to initialize the database as it's empty. To do that, open a shell into the API container and run:

```bash
npx prisma migrate dev
```

This command is also needed after the database schema is changed. The protocol is:

- One developer changed [the schema](./api/prisma/schema.prisma). He will run
  `npx prisma migrate dev --name add_a_new_field`. This will generate a
  migration, e.g. [this
  migration](./api/prisma/migrations/20221206194247_add_google_login/migration.sql).
  The schema change along with this migration need to be checked in to git.
- Another developer pulls the change, then running the `npx prisma migrate dev` (in the api container's shell) to apply the schema change.

## Auto-completion & Linting

Although we developed this project using docker, we still want features like auto-completion and linting while coding. For that to work, you need to install the all the relevant node packages, i.e.

```bash
# api, proxy, runtime, ui
cd ./api/

# Run 'npm install' instead if you are using npm
yarn
```
