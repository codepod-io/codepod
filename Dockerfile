FROM node:18

WORKDIR /app
COPY . .

WORKDIR /app/api
RUN yarn install --frozen-lockfile
WORKDIR /app/proxy
RUN yarn install --frozen-lockfile
WORKDIR /app/runtime
RUN yarn install --frozen-lockfile
WORKDIR /app/ui
RUN yarn install --frozen-lockfile

WORKDIR /app/

CMD ["tail", "-f", "/dev/null"]
