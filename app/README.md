# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

# Development

1. run `npm run start` in cpkernel
2. run `npm run start` in ui
3. run `npm run ele` in app
   - so the app is only a manager session to launch kernel and ui in the
     package. It is completely useless during development.

UPDATE: now just run `npm run dev`

The cpkernel is linked, so need to run `npm link ../cpkernel`. Otherwise, the
cpkernel is copied to node_modules and won't be built.

# Build

1. run `npm run build` in cpkernel
2. run `npm run bulid` in ui
3. run `npm run build` in app
4. run `npm run package` in app
   - the packaged app is in dist/

Since electron app cannot console.log to stdout, I need a way to see the errors.
Currently I log into a file /tmp/a.txt and use `tail -f /tmp/a.txt` to monitor
the results.

To extract app.asar:

```
npx asar extract app.asar destfolder
```

## Available Scripts

In the project directory, you can run:

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `yarn test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.
