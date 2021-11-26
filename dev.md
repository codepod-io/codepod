# Development Notes

# Dev notes

```
docker stop $(docker ps  -a  | grep cpkernel_ | awk '{print $1}')
docker rm $(docker ps  -a  | grep cpkernel_ | awk '{print $1}')
```


# About electron:

- electron does not support ES6 modules
- package used in electron might have node version mismatch. To solve that:
  - add electron-rebuild to the dev dep (already added here)
  - after npm install or yarn, run ./node_modules/.bin/electron-rebuild

To develop the electoron app:

1. go into ui directory and `yarn start` to start the UI server at localhost:3000. When delivered as an electron app, the react UI is compiled to dist. When the app starts, it will access file:/path/to/index.html instead of http://localhost:3000.
2. go into the cpkernel direcotry and `yarn start`. This will start the backend server (both repo server and kernel server) at http://localhost:14321.

- the kernel server is ws://localhost:14321
- the repo server is http://localhost:14321/graphql
- When delievered as an electron app, the backend is packaged as a cpkernel pacakge,and the server is launched via electron's main.js process at http://localhost:14321

3. go into ui directory and run `yarn ele` to start the electron app.

To build the electron app:

1. go to ui directory and yarn build. The UI is built into the app.
2. TODO install the cpkernel package and launch the server in main.js

# Intro

The app contains the front-end (ui) and the back-end (api). To run, start both:

```
cd api && docker-compose up -d
cd api && yarn dev
cd ui && yarn start
cd api && npx prisma studio
```

The portals:

- http://localhost:4000/graphq
- http://localhost:3000 is the web UI
- https://studio.apollographql.com/dev
- The db admin page is http://localhost:8080

- A docker compose file to specify the
  - db server
  - volume
  - backup server & volume


# Wiki

## neo4j

delete all:

```cypher
MATCH (n)
DETACH DELETE n
```

add unique constraints

```
CREATE CONSTRAINT constraint_name ON (book:Book) ASSERT book.isbn IS UNIQUE
```

For the users:

```
CREATE CONSTRAINT username ON (u:User) ASSERT u.username IS UNIQUE
CREATE CONSTRAINT email ON (u:User) ASSERT u.email IS UNIQUE
```

Show constraints:

```
SHOW CONSTRAINTS
```

## RabbitMQ

- over websocket https://www.rabbitmq.com/web-stomp.html
- the client document http://jmesnil.net/stomp-websocket/doc/
- docker image: https://registry.hub.docker.com/_/rabbitmq/
