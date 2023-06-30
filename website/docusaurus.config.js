// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Codepod IDE",
  tagline: "Canvas-based Scalable Interactive Coding",
  favicon: "img/logo.png",

  // Set the production url of your site here
  url: "https://codepod.io",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "CodePod Inc.", // Usually your GitHub org/user name.
  projectName: "Codepod", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          // editUrl:
          //   "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          // editUrl:
          //   "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: "img/docusaurus-social-card.jpg",
      navbar: {
        title: "Codepod",
        logo: {
          alt: "Codepod Logo",
          src: "img/logo.png",
        },
        items: [
          {
            // type: "doc",
            to: "docs/intro",
            position: "left",
            label: "Docs",
          },
          // { to: "/blog", label: "Blog", position: "left" },
          { to: "/docs/manual", label: "Manual", position: "left" },
          {
            to: "docs/gsoc2023",
            position: "left",
            label: "GSoC-2023",
          },
          {
            to: "docs/press",
            position: "left",
            label: "Screenshots",
          },
          {
            href: "https://github.com/codepod-io/codepod",
            label: "GitHub",
            position: "right",
          },
          {
            to: "https://app.codepod.io/login",
            label: "Login",
            position: "right",
            target: "",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              {
                label: "Tutorial",
                to: "/docs/intro",
              },
            ],
          },
          {
            title: "Community",
            items: [
              // {
              //   label: "Stack Overflow",
              //   href: "https://stackoverflow.com/questions/tagged/docusaurus",
              // },
              // {
              //   label: "Discord",
              //   href: "https://discordapp.com/invite/docusaurus",
              // },
              // {
              //   label: "Twitter",
              //   href: "https://twitter.com/docusaurus",
              // },
              {
                label: "GitHub",
                href: "https://github.com/codepod-io/codepod",
              },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "Blog",
                to: "/blog",
              },
              {
                label: "GitHub",
                href: "https://github.com/codepod-io/codepod",
              },
              {
                label: "Privacy Policy",
                to: "/docs/Reference/Legal/privacy-policy",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} CodePod Inc.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
  plugins: [
    async function myPlugin(context, options) {
      return {
        name: "docusaurus-tailwindcss",
        configurePostCss(postcssOptions) {
          // Appends TailwindCSS and AutoPrefixer.
          postcssOptions.plugins.push(require("tailwindcss"));
          postcssOptions.plugins.push(require("autoprefixer"));
          return postcssOptions;
        },
      };
    },
  ],
};

module.exports = config;
