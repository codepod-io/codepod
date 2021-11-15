FROM racket/racket:8.1-full


# reinstall pict
# RUN raco pkg install --auto --force
# git://github.com/racket/pict/?path=pict-lib

# RUN raco pkg install --auto iracket
# RUN raco iracket install
#
# install build deps so that I'll just run local install everytime a new
# contianer is created
RUN raco pkg install --auto zeromq-r-lib uuid sha
RUN raco pkg install iracket

# COPY ./codepod-conn-racket.json /codepod-conn-racket.json
COPY ./start.sh /start.sh
COPY ./conn.json /conn.json

# FIXME I need to map the ports
# CMD ["racket", "-l", "iracket/iracket", "--", "/codepod-conn-racket.json"]
# CMD ["bash"]
# ENTRYPOINT ["tail", "-f", "/dev/null"]
CMD ["racket", "-l", "iracket/iracket", "--", "-t", "/conn.json"]
