# Pebble Development Platform (PDP)

The app contains the front-end (ui) and the back-end (api). To run, start both:

```
cd api && yarn start
cd ui && yarn start
```

The API listen on http://localhost:4001, you will open the graphql playground there. Also available in https://studio.apollographql.com/dev. The current database is neo4j sandbox, I might need to use a local docker image to host the database.

- a docker compose file to specify the
  - db server
  - volume
  - backup server & volume

The front-end will listen to http://localhost:3000
