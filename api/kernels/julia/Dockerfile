FROM julia:1.6.2

# psmisc for killall
RUN apt-get update && apt-get install psmisc

# just to install dependencies. I'll use a development version of IJulia
RUN julia -e 'import Pkg; Pkg.add("IJulia")'


# "/root/.julia/packages/IJulia/e8kqU/src/kernel.jl"
RUN KERNEL_PATH=`julia -e 'import IJulia; print(joinpath(dirname(pathof(IJulia)), "kernel.jl"))'` &&\
    echo $KERNEL_PATH &&\
    # FIXME this will cause julia kernel to print warning saying module is not
    # the same (because the path is not the same)
    ln -sf $KERNEL_PATH /kernel.jl

RUN julia -e 'import Pkg; Pkg.add("Reexport")'
RUN julia -e 'import Pkg; Pkg.status()'

COPY ./start.sh /start.sh
COPY ./conn.json /conn.json

# ENTRYPOINT ["tail", "-f", "/dev/null"]
CMD [ "julia", "-i", "--color=yes", "/kernel.jl", "/conn.json"]