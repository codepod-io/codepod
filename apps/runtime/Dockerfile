FROM node:18 AS builder

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

FROM node:18 AS server
WORKDIR /app
COPY package.json yarn.lock ./
COPY kernel ./kernel
RUN yarn install --production
COPY --from=builder ./app/build ./build
EXPOSE 4020
CMD ["yarn", "start"]