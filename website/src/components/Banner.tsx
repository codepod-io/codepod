import React from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";

function JupyterConBanner() {
  // persist this banner in local storage
  const key = "jupytercon-banner";
  const value =
    (typeof window !== "undefined" && localStorage.getItem(key)) || false;
  const [close, setClose] = React.useState(value);
  if (close) return null;
  return (
    <div className="z-10 mx-auto w-full p-0 relative isolate flex items-center gap-x-6 overflow-hidden bg-gray-50 py-2.5 px-6 sm:px-3.5 sm:before:flex-1">
      <svg
        viewBox="0 0 577 310"
        aria-hidden="true"
        className="absolute top-1/2 left-[max(-7rem,calc(50%-52rem))] -z-10 w-[36.0625rem] -translate-y-1/2 transform-gpu blur-2xl"
      >
        <path
          id="558b8b01-4d09-4091-8be3-c5da192b7892"
          fill="url(#4b688345-001e-47fa-aa7a-d561812ecf15)"
          fillOpacity=".3"
          d="m142.787 168.697-75.331 62.132L.016 88.702l142.771 79.995 135.671-111.9c-16.495 64.083-23.088 173.257 82.496 97.291C492.935 59.13 494.936-54.366 549.339 30.385c43.523 67.8 24.892 159.548 10.136 196.946l-128.493-95.28-36.628 177.599-251.567-140.953Z"
        />
        <defs>
          <linearGradient
            id="4b688345-001e-47fa-aa7a-d561812ecf15"
            x1="614.778"
            x2="-42.453"
            y1="26.617"
            y2="96.115"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#9089FC" />
            <stop offset={1} stopColor="#FF80B5" />
          </linearGradient>
        </defs>
      </svg>
      <svg
        viewBox="0 0 577 310"
        aria-hidden="true"
        className="absolute top-1/2 left-[max(45rem,calc(50%+8rem))] -z-10 w-[36.0625rem] -translate-y-1/2 transform-gpu blur-2xl"
      >
        <use href="#558b8b01-4d09-4091-8be3-c5da192b7892" />
      </svg>
      <p className="text-sm leading-6 text-gray-900">
        We are excited to give a talk at <b>JupyterCon 2023</b> on May 10-12,
        2023. See you in Paris!{" "}
        <a
          href="https://www.jupytercon.com/"
          target="_blank"
          className="whitespace-nowrap font-semibold"
        >
          Learn more&nbsp;<span aria-hidden="true">&rarr;</span>
        </a>
      </p>
      <div className="flex flex-1 justify-end">
        <button
          type="button"
          className="-m-3 p-3 focus-visible:outline-offset-[-4px]"
          onClick={() => {
            setClose(true);
            typeof window !== "undefined" && localStorage.setItem(key, "true");
          }}
        >
          <span className="sr-only">Dismiss</span>
          <XMarkIcon className="h-5 w-5 text-gray-900" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function Banner() {
  return (
    <>
      <JupyterConBanner />
    </>
  );
}
