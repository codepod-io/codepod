import React from "react";
import clsx from "clsx";
import styles from "./HomepageFeatures/styles.module.css";

const FeatureList1 = [
  {
    title: "Why",
    Svg: require("../../static/img/undraw_docusaurus_mountain.svg").default,
    description: (
      <>
        Codepod provides the interactive coding experience popularized by
        Jupyter, but with scalability and production-readiness. <br />
        {/* Codepod was invented because Jupyter is usually only suitable for small-scale prototyping or demonstrative projects. */}
        Users can still incrementally build up code by trying out a small code
        snippet each time. But they would not be overwhelmed by the great number
        of code snippets as the projects grow.
      </>
    ),
  },
  {
    title: "How",
    Svg: require("../../static/img/undraw_docusaurus_tree.svg").default,
    description: (
      <>
        {/* Docusaurus lets you focus on your docs, and we&apos;ll do the chores. Go */}
        {/* ahead and move your docs into the <code>docs</code> directory. */}
        CodePod offers freeform coding on a hierarchical 2D canvas to spatially
        and semantically modularize code.
        <br />
        Code snippets can be inserted anywhere on the canvas, and can be
        hierarchically organized into modules. In this way, Codepod allows
        managing large amounts of code without using files.
      </>
    ),
  },
  {
    title: "So what",
    Svg: require("../../static/img/undraw_docusaurus_react.svg").default,
    description: (
      <>
        {/* Extend or customize your website layout by reusing React. Docusaurus can */}
        {/* be extended while reusing the same header and footer. */}
        With Codepod, interactive programming is no longer limited to
        small-scale prototyping or demonstrative projects. Not only can one
        remain fast in prototyping, but also quick in prototype-to-product
        conversion as code is modularized rather than intermingled as in
        Jupyter.
      </>
    ),
  },
];

const FeatureList2 = [
  {
    title: "Open-source",
    Svg: require("../../static/img/undraw_docusaurus_mountain.svg").default,
    description: (
      <>
        Like you, we believe in open-source. You can find our{" "}
        <a href="https://github.com/codepod-io/codepod" target="_blank">
          source code
        </a>{" "}
        on GitHub. We'd like your contribution to make it better!
      </>
    ),
  },
  {
    title: "Zoom in and out your code",
    Svg: require("../../static/img/undraw_docusaurus_tree.svg").default,
    description: (
      <>
        {/* Docusaurus lets you focus on your docs, and we&apos;ll do the chores. Go */}
        {/* ahead and move your docs into the <code>docs</code> directory. */}
        In CodePod, you can zoom out to see the big picture, as well as zoom in
        to a line. Just a swipe or scroll. No more going up and down the folder
        hierarchy and close and open a series of files or tabs.
      </>
    ),
  },
  {
    title: "Any language, and any domain",
    Svg: require("../../static/img/undraw_docusaurus_react.svg").default,
    description: (
      <>
        {/* Extend or customize your website layout by reusing React. Docusaurus can */}
        {/* be extended while reusing the same header and footer. */}
        Codepod's dream is to expand REPL or the interactive or exploratory
        coding experience from Data Science and Machine Learning (dominated by
        Python), to any domain and any programming language.
      </>
    ),
  },
];

function Feature({ Svg, title, description }) {
  return (
    <div className={clsx("col col--4")}>
      {/* <div className="text--center">
        <Svg className={styles.featureSvg} alt={title} />
      </div> */}
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function WhyIn3() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList1.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
