FROM node:16

WORKDIR /app
COPY ./package.json package.json
RUN yarn

COPY . .

CMD ["yarn", "start"]
