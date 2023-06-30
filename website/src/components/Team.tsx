import React from "react";
import { Box } from "@mui/material";

const people = [
  {
    name: "Hebi Li",
    role: "CEO, co-founder",
    imageUrl: "/img/hebi-paris.jpeg",
    // imageUrl:
    //   "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    // bio: "Quia illum aut in beatae. Possimus dolores aliquid accusantium aut in ut non assumenda. Enim iusto molestias aut deleniti eos aliquid magnam molestiae. At et non possimus ab. Magni labore molestiae nulla qui.",
    bio: (
      <Box>
        Hebi is an ex-Google-Brainer and an ex-ByteDancer.
        <a
          href="https://lihebi.com"
          //   className="text-sky-500 hover:text-sky-600"
        >
          https://lihebi.com
        </a>
      </Box>
    ),
  },
  {
    name: "Forrest Bao",
    role: "CPO, co-founder",
    imageUrl: "/img/forrest.jpg",
    // imageUrl:
    //   "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    bio: (
      <Box>
        Forrest is an AI veteran and series entrepreneur.
        <a
          href="https://forrestbao.github.io"
          className="text-sky-500 hover:text-sky-600"
        >
          https://forrestbao.github.io
        </a>
      </Box>
    ),
  },
  // More people...
];

export function Team() {
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl sm:text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Meet our team
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            We’re a dynamic group of individuals who are passionate about what
            we do. We’re always looking for new talent to join our team.
          </p>
        </div>
        <ul
          role="list"
          className="mx-auto mt-20 grid max-w-2xl grid-cols-1 gap-x-6 gap-y-20 sm:grid-cols-2 lg:max-w-4xl lg:gap-x-8 xl:max-w-none"
        >
          {people.map((person) => (
            <li key={person.name} className="flex flex-col gap-6 xl:flex-row">
              <img
                className="aspect-[4/5] w-52 flex-none rounded-2xl object-cover"
                src={person.imageUrl}
                alt=""
              />
              <div className="flex-auto">
                <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-900">
                  {person.name}
                </h3>
                <p className="text-base leading-7 text-gray-600">
                  {person.role}
                </p>
                <div className="mt-6 text-base leading-7 text-gray-600">
                  {person.bio}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Contactus() {
  return (
    <div className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-md px-6 sm:max-w-lg lg:max-w-7xl lg:px-8">
        <h2 className="text-center text-3xl font-bold leading-10 tracking-tight text-gray-900 sm:text-4xl sm:leading-none">
          Get in touch
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xl leading-normal text-gray-500">
          invest@codepod.team
        </p>
      </div>
    </div>
  );
  return (
    <div className="bg-white py-24 px-6 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Support center
        </h2>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          invest@codepod.team
        </p>
      </div>
    </div>
  );
}
