# Helm charts for CodePod

## Prerequist

Also need the secrets:

```
apiVersion: v1
kind: Secret
type: Opaque
metadata:
  name: mysecret
data:
  POSTGRES_USER:
  POSTGRES_PASSWORD:
  POSTGRES_DB:
  JWT_SECRET:
```

Note: the secrets must be base64 encoded with:

    echo -n your-password | base64

Need the -n there, otherwise there will be a space when this secret is used in
env variables. Ref: https://github.com/kubernetes/kubernetes/issues/28086

Need to manually apply these secrets:

```
kubectl apply -f secrets.yaml
```

## Install

We need to create one more namespace manually:

    kubectl create ns codepod-staging-runtime

Install:

    helm install codepod-staging . --namespace codepod-staging --create-namespace --values=./values.staging.yaml

Upgrade:

    helm upgrade codepod-staging . --namespace codepod-staging --values=./values.staging.yaml

Optionally initialize the DB (run in one api pod):

    npx prisma migrate dev --name init

- TODO: automate this
- TODO: restore from backup

Uninstall:

    helm uninstall codepod-staging
