FROM julia:1.6.2

# psmisc for killall
RUN apt-get update && apt-get install psmisc

# just to install dependencies. I'll use a development version of IJulia
RUN julia -e 'import Pkg; Pkg.add("IJulia")'

COPY ./start.sh /start.sh

ENTRYPOINT ["tail", "-f", "/dev/null"]
