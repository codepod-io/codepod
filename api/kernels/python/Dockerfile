FROM python:3.10.0b4-buster

RUN pip install ipykernel

COPY ./conn.json /conn.json

CMD ["python3", "-m", "ipykernel_launcher", "-f", "/conn.json"]
# ENTRYPOINT ["tail", "-f", "/dev/null"]
