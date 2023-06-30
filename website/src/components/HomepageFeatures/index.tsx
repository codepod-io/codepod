import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<"svg">>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Open-source",
    Svg: require("@site/static/img/undraw_docusaurus_mountain.svg").default,
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
    Svg: require("@site/static/img/undraw_docusaurus_tree.svg").default,
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
    Svg: require("@site/static/img/undraw_docusaurus_react.svg").default,
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

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
