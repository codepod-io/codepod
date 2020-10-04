import React from 'react';
import ReactDOM from 'react-dom';
// import 'codemirror.css'
import App from './App';
import * as serviceWorker from './serviceWorker';
import './index.css';

ReactDOM.render(
  <React.StrictMode>
    <App />
    {/* <div id="raweditor"></div>
    <textarea id="editor" className="h-auto"></textarea> */}
  </React.StrictMode>,
  document.getElementById('root')
);



// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();

// var myCodeMirror = CodeMirror(document.body);

// var myCodeMirror = CodeMirror(document.getElementById("raweditor"), {
//   value: "function myScript(){return 100;}\n",
//   mode:  "javascript"
// });
