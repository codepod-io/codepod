# CP Kernel

This is a package designed for code sharing between codepod API and electron server.

To use the kernel:
If you use `yarn`, you can run `yarn add link:/path/to/cpkernel`. However, this will not work with npm. For npm, you need to run `npm link` in cpkernel folder to globally register the package, and run `npm link cpkernel` to link. This won't reflect in package.json.

Thus the ideal setup should be to add cpkernel to package.json, but not to install it. Instead, run `npm link cpkernel` during development.
