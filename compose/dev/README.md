# Dev Compose

# Introduction

- codepod.test:3000 the UI
- git.codepod.test:3000: the gitweb as well as the git clone prefix

# The git server, gitweb, and cgit

## The best one

https://github.com/anyakichi/docker-git-http

This is THE one. It contains both git server and gitweb, and the git web seems
good. It uses subdomain git.codepod.io without a problem.

```
  git-http:
    build: ./docker-git-http
    ports:
      - "2224:80"
    volumes:
      - git-data:/var/lib/git
```

## git-server

### SSH server

```
  # git:
  #   image: jkarlos/git-server-docker
  #   restart: always
  #   ports:
  #     - "2222:22"
  #   volumes:
  #     - ~/git-server/keys:/git-server/keys
  #     - ~/git-server/repos:/git-server/repos

```

### http server

- http://localhost:2223/xxx.git
- Problems:
  - no gitweb
  - the parent repo has gitweb (which is the one I decide to use in the end)

```
  # The repo is
  # where the xxx.git is a BARE repo in the root of the volume
  #
  # https://github.com/cirocosta/gitserver-http
  git-http:
    image: cirocosta/gitserver-http
    restart: always
    ports:
      - "2223:80"
    volumes:
      # - ~/Documents/git:/var/lib/git/
      # - ~/git-server/repos:/var/lib/git:ro
      - git-data:/var/lib/git
```

## gitweb

### https://github.com/mlan/docker-gitweb

```
  # Not working, project not found
  #
  #
  # gitweb2:
  #   image: mlan/gitweb
  #   ports:
  #     - "1236:80"
  #   volumes:
  #     - git-data:/var/lib/git:ro
```

### https://github.com/iconoeugen/docker-gitweb

Cons:

- it redirects and remove ports, from gitweb.codepod.io:3000/git to gitweb.codepod.io/git
- also, the ENV vairables seems strange

```

  # working, but no authentication. I could build authentication at nginx/httpd
  # level
  #
  #
  #
  # other options
  # - https://github.com/fraoustin/gitweb
  gitweb:
    build: ./gitweb
    ports:
      - "1234:8080"
    volumes:
      - git-data:/var/lib/git:ro
      # - ~/git-server/repos:/var/lib/git:ro
      # - ~/Documents/git:/var/lib/git/:ro
    environment:
      - http_proxy
      - https_proxy
      - ftp_proxy
      - no_proxy
      - GIT_PROJECT_NAME=dummy
```

## cgit

- https://github.com/invokr/docker-cgit
  - the file content is not shown
- https://github.com/marcopompili/docker-nginx-cgit
  - the list of project is not updated. I have to stop, rm the container and
    fire it again to show new list of project.

```

  #
  cgit:
    # image: invokr/cgit
    #
    image: emarcs/nginx-cgit
    ports:
      - "1235:80"
    volumes:
      - git-data:/srv/git:ro
      # - ~/Documents/git:/srv/git:ro
```

# nginx rewrites (not good)

```

# location /git {
#         proxy_pass http://git-http:80;
# }
# location /gitweb/ {
#         rewrite    /gitweb/ /git/ break;
#         proxy_pass http://gitweb:8080;
# }
# location /gitweb.cgi/ {
#         proxy_pass http://gitweb:8080;
# }
# location /cgit/ {
#         rewrite    /cgit / break;
#         proxy_pass http://cgit:80;
# }
# location ~ /cgit\..* {
#         proxy_pass http://cgit:80;
# }
# location /cgit.css {
#         proxy_pass http://cgit:80;
# }
```
