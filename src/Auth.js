import React, { useContext, useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { Link, Redirect } from "react-router-dom";
import { AuthContext } from "./AuthContext";

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

export function Login() {
  const [error, setError] = useState(null);
  const { login, isLoggedIn } = useContext(AuthContext);

  return isLoggedIn ? (
    <Redirect to="/"></Redirect>
  ) : (
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
              setError(null);
              return login(values.email, values.password).catch((err) => {
                setError(err.message);
              });
            }}
          >
            {({ isSubmitting }) => (
              <Form className="mt-8 space-y-6">
                <div className="rounded-md shadow-sm -space-y-px">
                  <div>
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
                  </div>

                  <div>
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
                {error && (
                  <div>
                    <span className="text-red-500">Error: {error}</span>
                  </div>
                )}
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

export function SignUp() {
  const [error, setError] = useState(null);
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

          <Formik
            initialValues={{ email: "", password: "", username: "" }}
            validate={(values) => {
              const errors = {};
              if (!values.email) {
                errors.email = "Email is Required";
              } else if (
                !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
              ) {
                errors.email = "Invalid email address";
              }
              return errors;
            }}
            onSubmit={(values, { setSubmitting }) => {
              setError(null);
              // send to backend
              // FIXME https
              const query = {
                query: `
                    mutation {
                      createUser(username: "${values.username}",
                        email: "${values.email}",
                        password: "${values.passwod}",
                        firstname:"") {
                        id, username, email, firstname
                      }
                    }
                  `,
              };
              console.log(query);
              return fetch("http://localhost:5000/graphql", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(query),
              })
                .then((res) => {
                  if (res.status !== 200 && res.status !== 201) {
                    throw Error("Failed");
                  }
                  return res.json();
                })
                .then((res) => {
                  if (res.errors) {
                    setError(res.errors[0].message);
                  }
                  // console.log(res);
                  // console.log(res.data);
                  // console.log(res.data.users[0]);
                  // No errors, redirect to login page
                  // Save token, and redirect to dashboard or home
                  console.log(res.data.token);
                  console.log(res.data.userID);
                })
                .catch((err) => {
                  console.log(err);
                });
            }}
          >
            {({ isSubmitting }) => (
              <Form className="mt-8 space-y-6" action="/graphql" method="POST">
                {/* <input type="hidden" name="remember" value="true" /> */}
                <div className="rounded-md shadow-sm -space-y-px">
                  <div>
                    <label htmlFor="username" className="">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <Field
                      // FIXME type username
                      // type="username"
                      name="username"
                      required
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="">
                      Email address <span className="text-red-500">*</span>
                    </label>
                    <Field
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    />
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="text-red-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <Field
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="disabled:opacity-50 group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                      <Icon />
                    </span>
                    {isSubmitting ? "Submitting" : "Sign up"}
                  </button>
                </div>
                {error && (
                  <div>
                    <span className="text-red-500">Error: {error}</span>
                  </div>
                )}
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
}
