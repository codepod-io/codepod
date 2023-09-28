FROM node:18

# install bun
RUN curl -fsSL https://bun.sh/install | bash

# ENV

# export BUN_INSTALL="$HOME/.bun"
# export PATH=$BUN_INSTALL/bin:$PATH

ENV BUN_INSTALL="/root/.bun"
ENV PATH=$BUN_INSTALL/bin:$PATH