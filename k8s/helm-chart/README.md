# Helm charts for CodePod

## Prerequist

### Create namespaces

We need to create one more namespace manually:

    kubectl create ns codepod-staging
    kubectl create ns codepod-staging-runtime

### Apply the secrets

Need the secrets:

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

### Install longhorn

Longhorn is needed to dynamically allocate volumes for DB.

### Get SSL certificate (required for prod)

See `../cert-manager`. Basically:

1. install cert-manager
2. save cloudflare API token to secrets (to cert-manager ns)
3. define issuers (clusterwise)
4. retrieve certs (into codepod-prod namespace)

Ref: https://docs.technotim.live/posts/kube-traefik-cert-manager-le/#cert-manager

End result: the app-codepod-io-tls certificate.

## Install

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
