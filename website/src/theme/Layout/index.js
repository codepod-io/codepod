import React from "react";
import Layout from "@theme-original/Layout";
import { Banner } from "../../components/Banner";

export default function LayoutWrapper(props) {
  return (
    <>
      <Banner />
      <Layout {...props} />
    </>
  );
}
