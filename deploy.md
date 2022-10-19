# Deployment

Build the docker images:

```
docker build -t lihebi/codepod-ui:v0.4.2 ./ui
docker build -t lihebi/codepod-api:v0.4.2 ./api
docker build -t lihebi/codepod_kernel_python:v0.1.0 ./api/kernels/python
```

Push to registry:

```
docker push lihebi/codepod-ui:v0.4.2
docker push lihebi/codepod-api:v0.4.2
docker push lihebi/codepod_kernel_python:v0.1.0
```

Create a cloud VM with docker support. Add DNS from domain name to the cloud
server. Setup TLS, e.g., `app-v1.codepod.io`:

```
ufw allow 80
certbot certonly --standalone
```

Clone this repo on the cloud VM, and go to the production folder:

```
cd compose/prod
touch .env
```

Add your choice of secrets to the .env file (replace the placeholders):

```
POSTGRES_USER=<username>
POSTGRES_PASSWORD=<password>
POSTGRES_DB=<dbname>
JWT_SECRET=<yoursecret>
```

Change the domain name to your DNS in nginx.conf, e.g., `app-v1.codepod.io`:

Start the docker-compose stack:

```
docker compose up -d
```

Then, initialize a DB by shell into the api container and run:

```
npx prisma migrate dev --name init
```

Pull the kernel image:

```
docker pull lihebi/codepod_kernel_python:v0.1.0
docker tag lihebi/codepod_kernel_python:v0.1.0 codepod_kernel_python
```

Now go to

- https://app-v1.codepod.io the web app
