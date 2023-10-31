# CodePod: coding on a canvas, organized.

Codepod provides the interactive coding experience popularized by Jupyter, but
with scalability and production-readiness. Users can still incrementally build
up code by trying out a small code snippet each time. But they would not be
overwhelmed by the great number of code snippets as the projects grow. Learn
more on our website at https://codepod.io.

![screenshot](./screenshot-canvas.png)

# Install

You can [use CodePod online](https://app.codepod.io) without installing it
locally. To install it on your computer:

Step 1: install prerequisite: [nodejs](https://nodejs.org/en/download) runtime
and python & ipykernel:

```
brew install node # example for MacOS
pip3 install ipykernel
```

Step 2: Install codepod CLI app from [npm registry](https://www.npmjs.com/package/codepod):

```
> npm install -g codepod
> codepod --version
# 0.0.7
```

Step 3: launch CodePod from terminal:

```
> codepod /path/to/local/repo
# ... 🚀 Server ready at http://localhost:4001
```

Open this URL in your browser to see the app. The files will be saved to the
directory `/path/to/repo/codepod.bin|json`. The `codepod.bin` is the source of
truth, and `codepod.json` is for human-readability only.

In the future, you can update the app:

```
> npm update -g codepod
```

# Develop

Open two terminals. On one:

```
cd apps/api
pnpm dev
```

On the other:

```
cd apps/ui
pnpm dev
```

Now go to `http://localhost:3000` to see the app.

# Contributing

CodePod is open-source under an MIT license. Feel free to contribute to make
it better together with us. You can contribute by [creating awesome showcases](#gallery),
[reporting a bug, suggesting a feature](https://github.com/codepod-io/codepod/issues),
or submitting a pull request.
Do use [Prettier](https://prettier.io/) (e.g., [its VSCode
plugin](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode))
to format your code before checking in.

# Citation

https://arxiv.org/abs/2301.02410

```
@misc{https://doi.org/10.48550/arxiv.2301.02410,
  doi = {10.48550/ARXIV.2301.02410},
  url = {https://arxiv.org/abs/2301.02410},
  author = {Li, Hebi and Bao, Forrest Sheng and Xiao, Qi and Tian, Jin},
  title = {Codepod: A Namespace-Aware, Hierarchical Jupyter for Interactive Development at Scale},
  publisher = {arXiv},
  year = {2023},
  copyright = {Creative Commons Attribution 4.0 International}
}
```
