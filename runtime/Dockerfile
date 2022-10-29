FROM node:18 AS builder

WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn install --frozen-lockfile

# FIXME would this copy node_modules?
COPY . .

RUN yarn build

FROM node:18 AS server
WORKDIR /app
COPY package.json .
COPY yarn.lock .
COPY kernel ./kernel
RUN yarn install --production
COPY --from=builder ./app/build ./build
EXPOSE 4020
CMD ["yarn", "start"]