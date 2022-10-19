FROM node:18 AS builder
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:18 AS server
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn install --production
COPY prisma .
RUN yarn run prisma generate
COPY --from=builder ./app/build ./build
EXPOSE 4000
CMD ["yarn", "start"]