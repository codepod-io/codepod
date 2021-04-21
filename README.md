# Pebble Development Platform (PDP)

The app contains the front-end (ui) and the back-end (api). To run, start both:

```
cd api && yarn start
cd nextui && yarn dev
```

The API listen on http://localhost:4000/graphql, you will open the graphql playground there. Also available in https://studio.apollographql.com/dev. The current database is neo4j sandbox, I might need to use a local docker image to host the database.

- a docker compose file to specify the
  - db server
  - volume
  - backup server & volume

The front-end will listen to http://localhost:3000

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
