FROM node:16

RUN npm install -g ijavascript

COPY ./conn.json /conn.json

CMD ["ijskernel", "--hide-undefined", "/conn.json", "--protocol=5.1"]
