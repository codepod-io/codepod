FROM ubuntu:23.10

RUN apt-get update -y

# Essential packages
RUN apt-get install -y build-essential git curl wget

# https://stackoverflow.com/a/33963559
# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Install nvm and node:18
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
RUN source ~/.nvm/nvm.sh && nvm install 18 && nvm use 18

# Install python3
RUN apt-get install -y python3 python3-pip python3-venv

# Instead of sourcing the env directly:
# RUN python3 -m venv /opt/venv && source /opt/venv

# Do this: set the venv path to PATH so that we don't need to source it.
# https://pythonspeed.com/articles/activate-virtualenv-dockerfile/
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN pip install ipykernel

ENV HOME /root

# Docker won't let us source nvm.sh directly, so we have several options: (ref:
# https://stackoverflow.com/a/55922307)
# 1. Avoid env. But nodejs binary package is hard to install.
# 2. Use ENV. But in this case, I need to use EXACT node version and set
#    NODE_PATH and PATH manually. Ref: https://stackoverflow.com/a/62838796
# 3. Use entrypoint to load the env, THEN run the actual CMD "$@". Ref:
#    https://stackoverflow.com/a/58755872
ENTRYPOINT ["sh", "-c", "source ~/.nvm/nvm.sh && \"$@\"", "-s"]

# CMD ["/bin/bash"]
# CMD ["bash", "-c", "node --version"]