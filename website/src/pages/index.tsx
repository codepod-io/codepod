import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";

import styles from "./index.module.css";
import WhyIn3 from "../components/WhyIn3";
import { Box } from "@mui/material";
import { ChevronRightIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import { Dialog } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Team, Contactus } from "../components/Team";
import { Hero } from "../components/Hero";

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={`${siteConfig.title}`} description={`${siteConfig.tagline}`}>
      <Hero />
      <main>
        <WhyIn3 />
        <hr />
        <div>
          <Box
            sx={{
              flexGrow: 1,
              width: "80%",
              mx: "auto",
              justifyContent: "center",
            }}
          >
            {/* <h3 align="center">Spread your code cells in 2D on a canvas with hierarchy and namespace management! </h3> */}
            <a href="/img/graph_based_LDA.png">
              <img src="/img/graph_based_LDA.png" alt="Product screenshot" />
            </a>
          </Box>
        </div>
        <HomepageFeatures />
        <hr />
        <Team />
        <Contactus />
      </main>
    </Layout>
  );
}
