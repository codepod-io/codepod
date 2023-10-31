# Building CodePod

First build the UI:

```
cd ui
pnpm bulid
```

This will generate the frontend html/js files into `api/public` folder. Then build the app in `api/` folder:

```
cd api
pnpm build
```

This will generate `api/build/cli.js`. This is the binary executable. You can
install and test the app locally:

```
cd api
npm install -g .
```

Now the `codepod` command is available. Test:

```
> which codepod
# /opt/homebrew/bin/codepod
> npm list --global
# /opt/homebrew/lib
# ├── codepod@0.0.4 -> ./../../../Users/xxx/git/codepod/api
> codepod /path/to/repo
# ... 🚀 Server ready at http://localhost:4001
```

Remove the globally installed local package:

```
npm remove -g codepod
```

Now it's ready to publish. We will first publish to npm registry. First login to
npm-cli, upgrade the version in `api/package.json` then:

```
npm publish
```

Now it is in npm at https://www.npmjs.com/package/codepod. Install it from npm:

```
# option 1: install
npm install -g codepod
codepod /path/to/repo

# option 2: run with npx without install
npx codepod /path/to/repo
```
