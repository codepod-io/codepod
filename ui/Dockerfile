FROM node:18 AS builder

WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn install --frozen-lockfile

# FIXME would this copy node_modules?
COPY . .

ENV NODE_OPTIONS="--max_old_space_size=4096"
RUN yarn build

FROM nginx:1.19-alpine AS server

# https://stackoverflow.com/questions/45598779/react-router-browserrouter-leads-to-404-not-found-nginx-error-when-going-to
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder ./app/build /usr/share/nginx/html
COPY ./set-env.sh /usr/share/nginx/html/set-env.sh
CMD ["sh", "-c", "cd /usr/share/nginx/html/ && ./set-env.sh && nginx -g 'daemon off;'"]
