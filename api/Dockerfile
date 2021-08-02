FROM node:16

WORKDIR /app
COPY package.json .
RUN yarn

COPY . .
# this will modify node_modules/@prisma/client
RUN yarn run prisma generate

CMD ["yarn", "dev"]
