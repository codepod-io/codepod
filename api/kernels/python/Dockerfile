FROM python:3.9-buster

RUN pip install ipykernel

COPY ./conn.json /conn.json

CMD ["python3", "-m", "ipykernel_launcher", "-f", "/conn.json"]
# ENTRYPOINT ["tail", "-f", "/dev/null"]
