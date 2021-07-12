# Pebble Development Platform (PDP)

The app contains the front-end (ui) and the back-end (api). To run, start both:

```
cd api && docker-compose up -d
cd api && yarn dev
cd ui2 && yarn start
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
