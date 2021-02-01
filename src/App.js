import React, { useEffect, useRef, useState } from "react";
import { TreePods, SequentialPods } from "./Pod.js";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
// import "./tailwind.output.css";
import { Formik, Form, Field, ErrorMessage } from "formik";

import "./App.css";

function Home() {
  return (
    <div>
      <h1>Home</h1>
    </div>
  );
}

function About() {
  return (
    <div>
      <h1>About</h1>
    </div>
  );
}

function Login() {
  function dologin(e) {
    // e.preventDefault();
  }
  return (
    <div>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <img
              className="mx-auto h-12 w-auto"
              src="https://tailwindui.com/img/logos/workflow-mark-indigo-600.svg"
              alt="Workflow"
            />
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Sign in to your account
            </h2>
          </div>

          <Formik
            initialValues={{ email: "", password: "" }}
            validate={(values) => {
              const errors = {};
              if (!values.email) {
                errors.email = "Required";
              } else if (
                !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
              ) {
                errors.email = "Invalid email address";
              }
              return errors;
            }}
            onSubmit={(values, { setSubmitting }) => {
              setTimeout(() => {
                alert(JSON.stringify(values, null, 2));
                setSubmitting(false);
              }, 400);
            }}
          >
            {({ isSubmitting }) => (
              <Form className="mt-8 space-y-6">
                <div className="rounded-md shadow-sm -space-y-px">
                  <label>
                    Email address &nbsp;
                    <span className="text-red-500">*</span>
                  </label>
                  <Field
                    type="email"
                    name="email"
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  ></Field>
                  <ErrorMessage
                    name="email"
                    component="div"
                    className="text-red-500"
                  />
                  <label>
                    Password &nbsp;
                    <span className="text-red-500">*</span>
                  </label>
                  <Field
                    type="password"
                    name="password"
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  />
                  <ErrorMessage
                    name="password"
                    className="text-red-500"
                    component="div"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Field
                      type="checkbox"
                      name="remember_me"
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    ></Field>
                    <label
                      htmlFor="remember_me"
                      className="ml-2 block text-sm text-gray-900"
                    >
                      Remember me
                    </label>
                  </div>
                  <div className="text-sm">
                    <a
                      href="#"
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Forgot your password?
                    </a>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <Icon />
                  </span>
                  Sign in
                </button>
              </Form>
            )}
          </Formik>

          <p className="mt-2 text-center text-sm text-gray-600">
            New to CodePod? &nbsp;
            <Link
              to="/signup"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function SignUp() {
  function dosignup() {}
  return (
    <div>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <img
              className="mx-auto h-12 w-auto"
              src="https://tailwindui.com/img/logos/workflow-mark-indigo-600.svg"
              alt="Workflow"
            />
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Sign up your account
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Or&nbsp;
              <Link
                to="/login"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign in with existing account
              </Link>
            </p>
          </div>
          <form className="mt-8 space-y-6" action="/graphql" method="POST">
            <input type="hidden" name="remember" value="true" />
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="username" className="">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  id="username"
                  name="username"
                  // type="email"
                  // autocomplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  // placeholder="username"
                />
              </div>
              <div>
                <label htmlFor="email" className="">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  // placeholder="Email address"
                />
              </div>
              <div>
                <label htmlFor="password" className="">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  // placeholder="Password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                onClick={dosignup}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <Icon />
                </span>
                Sign up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Icon() {
  return (
    <svg
      className="h-5 w-5 text-indigo-500 group-hover:text-indigo-400"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function NavBar() {
  return (
    <nav className="bg-gray-800 flex text-white px-10 py-5">
      <Link to="/" className="flex-1">
        CodePod
      </Link>
      <ul className="flex space-x-4">
        <li>
          <Link to="/about" className="hover:bg-gray-700 px-2 py-2">
            About
          </Link>
        </li>
        <li>
          <Link to="/login" className="hover:bg-gray-700 px-2 py-2">
            Sign in
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div>
        <NavBar></NavBar>

        {/* A <Switch> looks through its children <Route>s and
            renders the first one that matches the current URL. */}
        <Switch>
          <Route path="/about">
            <About />
          </Route>
          <Route path="/login">
            <Login />
          </Route>
          <Route path="/signup">
            <SignUp />
          </Route>
          <Route path="/">
            <Home />
          </Route>
        </Switch>
      </div>
    </Router>
  );
}

// <div className="App">
//       <h1>
//         CodePod: the <span className="text-red-300">Pod</span> Development
//         Platform
//       </h1>
//       <h2>Start editing to see some magic happen!</h2>
//       <p className="text-blue-300">some random staff</p>
//       <SequentialPods />
//       <button className="insert-btn">+</button>
//       <div className="insert">+</div>
//       <TreePods />
//       Tempor et mollit et nisi ex minim tempor deserunt ullamco amet voluptate
//       exercitation adipisicing. Elit pariatur irure sint tempor irure est
//       adipisicing ut dolore dolore adipisicing veniam id exercitation. Elit amet
//       quis voluptate cupidatat aute cupidatat exercitation exercitation irure
//       incididunt irure do qui. Nostrud in proident eiusmod ipsum quis nulla ea
//       aliqua.
//     </div>
