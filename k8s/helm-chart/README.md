# Helm charts for CodePod

## Prerequist

### Create namespaces

We need to create one more namespace manually:

```bash
kubectl create ns codepod-staging
kubectl create ns codepod-staging-runtime
```

### (DEPRECATED) Apply the secrets

Need the secrets:

```yaml
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

```bash
echo -n your-password | base64
```

Need the -n there, otherwise there will be a space when this secret is used in
env variables. Ref: [https://github.com/kubernetes/kubernetes/issues/28086](https://github.com/kubernetes/kubernetes/issues/28086)

Need to manually apply these secrets:

```bash
kubectl apply -f secrets.yaml
```

### (DEPRECATED) Install longhorn

Longhorn is needed to dynamically allocate volumes for DB.

### Get SSL certificate (required for prod)

See `../cert-manager`. Basically:

1. install cert-manager
2. save cloudflare API token to secrets (to cert-manager ns)
3. define issuers (clusterwise)
4. retrieve certs (into codepod-prod namespace)

Ref: [https://docs.technotim.live/posts/kube-traefik-cert-manager-le/#cert-manager](https://docs.technotim.live/posts/kube-traefik-cert-manager-le/#cert-manager)

End result: the app-codepod-io-tls certificate.

## Install

Install:

```bash
helm install codepod-staging . --namespace codepod-staging --create-namespace --values=./values.staging.yaml
```

Upgrade:

```bash
helm upgrade codepod-staging . --namespace codepod-staging --values=./values.staging.yaml
```

Optionally initialize the DB (run in one api pod):

```bash
npx prisma migrate dev --name init
```

- TODO: automate this
- TODO: restore from backup

Uninstall:

```bash
helm uninstall codepod-staging
```

Prod:

```bash
helm upgrade codepod-prod . --namespace codepod-prod --values=./values.prod.yaml
```

## Helper scripts

Alpha:

```bash
kubectl apply -f secrets.yaml -n codepod-alpha
helm install codepod-alpha . --namespace codepod-alpha --create-namespace --values=./values.alpha.yaml

helm upgrade codepod-alpha . --namespace codepod-alpha --values=./values.alpha.yaml
```

Rollback:

```bash
helm rollback -n codepod-alpha codepod-alpha
helm rollback -n codepod-alpha codepod-alpha 11
helm ls -n codepod-alpha
```

To access prisma:

```bash
kubectl port-forward prisma-deployment-5c9ccfc6b8-962vq 5555:5555 -n codepod-alpha
```

## Config maps and secrets

```yaml
apiVersion: v1
kind: Secret
type: Opaque
metadata:
 name: mysecret
data:
 POSTGRES_PASSWORD:
 JWT_SECRET:

```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myconfig
  namespace: codepod-alpha
data:
  POSTGRES_USER:
  POSTGRES_HOST:
  POSTGRES_DB:
  POSTGRES_PORT:
  GOOGLE_CLIENT_ID:
```
