import Prism from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/components/prism-php";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-java";
import "prismjs/components/prism-julia";
import "prismjs/components/prism-scheme";
import "prismjs/components/prism-racket";
import "prismjs/components/prism-typescript";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";

import { Slate, Editable, ReactEditor, withReact, useSlate } from "slate-react";
import { Text, createEditor, Editor, Transforms, Range } from "slate";
import { withHistory } from "slate-history";
import { css } from "@emotion/css";
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaExternalLinkSquareAlt,
  FaExternalLinkAlt,
  FaArrowsAltV,
} from "react-icons/fa";
import { MdImportExport, MdSwapVert, MdCallMissed } from "react-icons/md";

import Box from "@mui/material/Box";

import { Button, Menu, Portal } from "./slate_helper";

const toggleFormat = (editor, format) => {
  const isActive = isFormatActive(editor, format);
  Transforms.setNodes(
    editor,
    { [format]: isActive ? null : true },
    { match: Text.isText, split: true }
  );
};

const isFormatActive = (editor, format) => {
  const [match] = Editor.nodes(editor, {
    match: (n) => n[format] === true,
    mode: "all",
  });
  return !!match;
};

const RichLeaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }

  if (leaf.italic) {
    children = <em>{children}</em>;
  }

  if (leaf.underlined) {
    children = <u>{children}</u>;
  }

  if (leaf.strikethrough) {
    children = <strike>{children}</strike>;
  }

  if (leaf.export) {
    // yellow background
    children = (
      <Box
        component="span"
        sx={{
          background: "yellow",
        }}
      >
        {children}
      </Box>
    );
  }

  if (leaf.midport) {
    children = (
      <Box component="span" sx={{
        background="cyan"
      }}>
        {children}
      </Box>
    );
  }

  return { attributes, children, leaf };
};

const HoveringToolbar = ({ onExport = () => {}, onMidport = () => {} }) => {
  const ref = useRef();
  const editor = useSlate();

  useEffect(() => {
    const el = ref.current;
    const { selection } = editor;

    if (!el) {
      return;
    }

    if (
      !selection ||
      !ReactEditor.isFocused(editor) ||
      Range.isCollapsed(selection) ||
      Editor.string(editor, selection) === ""
    ) {
      el.removeAttribute("style");
      return;
    }

    const domSelection = window.getSelection();
    const domRange = domSelection.getRangeAt(0);
    const rect = domRange.getBoundingClientRect();
    el.style.opacity = "1";
    el.style.top = `${rect.top + window.pageYOffset - el.offsetHeight}px`;
    el.style.left = `${
      rect.left + window.pageXOffset - el.offsetWidth / 2 + rect.width / 2
    }px`;
  });

  return (
    <Portal>
      <Menu
        ref={ref}
        className={css`
          padding: 8px 7px 6px;
          position: absolute;
          z-index: 1;
          top: -10000px;
          left: -10000px;
          margin-top: -6px;
          opacity: 0;
          background-color: #222;
          border-radius: 4px;
          transition: opacity 0.75s;
        `}
      >
        <FormatButton format="bold" icon={<FaBold />} />
        <FormatButton format="italic" icon={<FaItalic />} />
        <FormatButton
          format="export"
          icon={<MdCallMissed />}
          onMouseDown={() => {
            const isActive = isFormatActive(editor, "export");
            // what if partially active?
            let name = Editor.string(editor, editor.selection);
            onExport(name, isActive);
          }}
        />
        <FormatButton
          format="midport"
          icon={<MdImportExport />}
          onMouseDown={() => {
            const isActive = isFormatActive(editor, "midport");
            // what if partially active?
            let name = Editor.string(editor, editor.selection);
            onMidport(name, isActive);
          }}
        />
        <FormatButton format="underlined" icon={<FaUnderline />} />
        <FormatButton format="strikethrough" icon={<FaStrikethrough />} />
      </Menu>
    </Portal>
  );
};

const FormatButton = ({ format, icon, onMouseDown = () => {} }) => {
  const editor = useSlate();
  return (
    <Button
      reversed
      active={isFormatActive(editor, format)}
      onMouseDown={(event) => {
        event.preventDefault();
        onMouseDown();
        toggleFormat(editor, format);
      }}
    >
      {icon}
    </Button>
  );
};

export function RichCodeSlate({
  value,
  onChange,
  language = "javascript",
  onExport = () => {},
  onMidport = () => {},
  onRun = () => {},
}) {
  const renderLeaf = useCallback((props) => <Leaf {...RichLeaf(props)} />, []);
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  // decorate function depends on the language selected
  const decorate = useCallback(
    ([node, path]) => {
      const ranges = [];
      // FIXME the highlighted text is not Text anymore, thus lose syntax highlighting
      if (!Text.isText(node)) {
        return ranges;
      }
      const tokens = Prism.tokenize(node.text, Prism.languages[language]);
      let start = 0;

      for (const token of tokens) {
        const length = getLength(token);
        const end = start + length;

        if (typeof token !== "string") {
          ranges.push({
            [token.type]: true,
            anchor: { path, offset: start },
            focus: { path, offset: end },
          });
        }

        start = end;
      }

      return ranges;
    },
    [language]
  );

  return (
    <Slate editor={editor} value={value} onChange={onChange}>
      <HoveringToolbar onExport={onExport} onMidport={onMidport} />
      <Editable
        decorate={decorate}
        renderLeaf={renderLeaf}
        placeholder="Write some code..."
        onKeyDown={(event) => {
          if (event.shiftKey && event.key === "Enter") {
            // console.log("Shift-enter!");
            event.preventDefault();
            // run code
            onRun();
          }
        }}
      />
    </Slate>
  );
}

export function CodeSlate({ value, onChange, language = "javascript" }) {
  const renderLeaf = useCallback((props) => <Leaf {...props} />, []);
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  // decorate function depends on the language selected
  const decorate = useCallback(
    ([node, path]) => {
      const ranges = [];
      if (!Text.isText(node)) {
        return ranges;
      }
      const tokens = Prism.tokenize(node.text, Prism.languages[language]);
      let start = 0;

      for (const token of tokens) {
        const length = getLength(token);
        const end = start + length;

        if (typeof token !== "string") {
          ranges.push({
            [token.type]: true,
            anchor: { path, offset: start },
            focus: { path, offset: end },
          });
        }

        start = end;
      }

      return ranges;
    },
    [language]
  );

  return (
    <Slate editor={editor} value={value} onChange={onChange}>
      <Editable
        decorate={decorate}
        renderLeaf={renderLeaf}
        placeholder="Write some code..."
      />
    </Slate>
  );
}

export const CodeHighlightingExample = () => {
  const [value, setValue] = useState(initialValue);
  const [language, setLanguage] = useState("html");

  return (
    <div>
      <div
        contentEditable={false}
        style={{ position: "relative", top: "5px", right: "5px" }}
      >
        <h3>
          Select a language
          <select
            value={language}
            style={{ float: "right" }}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="js">JavaScript</option>
            <option value="css">CSS</option>
            <option value="html">HTML</option>
            <option value="python">Python</option>
            <option value="sql">SQL</option>
            <option value="java">Java</option>
            <option value="php">PHP</option>
          </select>
        </h3>
      </div>
      <CodeSlate
        value={value}
        onChange={(value) => setValue(value)}
        language={language}
      />
    </div>
  );
};

const getLength = (token) => {
  if (typeof token === "string") {
    return token.length;
  } else if (typeof token.content === "string") {
    return token.content.length;
  } else {
    return token.content.reduce((l, t) => l + getLength(t), 0);
  }
};

// different token types, styles found on Prismjs website
const Leaf = ({ attributes, children, leaf }) => {
  return (
    <span
      {...attributes}
      className={css`
        font-family: monospace;
        background: hsla(0, 0%, 100%, 0.5);
        ${leaf.comment &&
        css`
          color: slategray;
        `}
        ${(leaf.operator || leaf.url) &&
        css`
          color: #9a6e3a;
        `}
        ${leaf.keyword &&
        css`
          color: #07a;
        `}
        ${(leaf.variable || leaf.regex) &&
        css`
          color: #e90;
        `}
        ${(leaf.number ||
          leaf.boolean ||
          leaf.tag ||
          leaf.constant ||
          leaf.symbol ||
          leaf["attr-name"] ||
          leaf.selector) &&
        css`
          color: #905;
        `}
        ${leaf.punctuation &&
        css`
          color: #999;
        `}
        ${(leaf.string || leaf.char) &&
        css`
          color: #690;
        `}
        ${(leaf.function || leaf["class-name"]) &&
        css`
          color: #dd4a68;
        `}
      `}
    >
      {children}
    </span>
  );
};

const initialValue = [
  {
    type: "paragraph",
    children: [
      {
        text: "<h1>Hi!</h1>",
      },
    ],
  },
];

// modifications and additions to prism library

Prism.languages.python = Prism.languages.extend("python", {});
Prism.languages.insertBefore("python", "prolog", {
  comment: { pattern: /##[^\n]*/, alias: "comment" },
});
Prism.languages.javascript = Prism.languages.extend("javascript", {});
Prism.languages.insertBefore("javascript", "prolog", {
  comment: { pattern: /\/\/[^\n]*/, alias: "comment" },
});
Prism.languages.html = Prism.languages.extend("html", {});
Prism.languages.insertBefore("html", "prolog", {
  comment: { pattern: /<!--[^\n]*-->/, alias: "comment" },
});
Prism.languages.markdown = Prism.languages.extend("markup", {});
Prism.languages.insertBefore("markdown", "prolog", {
  blockquote: { pattern: /^>(?:[\t ]*>)*/m, alias: "punctuation" },
  code: [
    { pattern: /^(?: {4}|\t).+/m, alias: "keyword" },
    { pattern: /``.+?``|`[^`\n]+`/, alias: "keyword" },
  ],
  title: [
    {
      pattern: /\w+.*(?:\r?\n|\r)(?:==+|--+)/,
      alias: "important",
      inside: { punctuation: /==+$|--+$/ },
    },
    {
      pattern: /(^\s*)#+.+/m,
      lookbehind: !0,
      alias: "important",
      inside: { punctuation: /^#+|#+$/ },
    },
  ],
  hr: {
    pattern: /(^\s*)([*-])([\t ]*\2){2,}(?=\s*$)/m,
    lookbehind: !0,
    alias: "punctuation",
  },
  list: {
    pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
    lookbehind: !0,
    alias: "punctuation",
  },
  "url-reference": {
    pattern:
      /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
    inside: {
      variable: { pattern: /^(!?\[)[^\]]+/, lookbehind: !0 },
      string: /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
      punctuation: /^[\[\]!:]|[<>]/,
    },
    alias: "url",
  },
  bold: {
    pattern: /(^|[^\\])(\*\*|__)(?:(?:\r?\n|\r)(?!\r?\n|\r)|.)+?\2/,
    lookbehind: !0,
    inside: { punctuation: /^\*\*|^__|\*\*$|__$/ },
  },
  italic: {
    pattern: /(^|[^\\])([*_])(?:(?:\r?\n|\r)(?!\r?\n|\r)|.)+?\2/,
    lookbehind: !0,
    inside: { punctuation: /^[*_]|[*_]$/ },
  },
  url: {
    pattern:
      /!?\[[^\]]+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)| ?\[[^\]\n]*\])/,
    inside: {
      variable: { pattern: /(!?\[)[^\]]+(?=\]$)/, lookbehind: !0 },
      string: { pattern: /"(?:\\.|[^"\\])*"(?=\)$)/ },
    },
  },
});
Prism.languages.markdown.bold.inside.url = Prism.util.clone(
  Prism.languages.markdown.url
);
Prism.languages.markdown.italic.inside.url = Prism.util.clone(
  Prism.languages.markdown.url
);
Prism.languages.markdown.bold.inside.italic = Prism.util.clone(
  Prism.languages.markdown.italic
);
Prism.languages.markdown.italic.inside.bold = Prism.util.clone(Prism.languages.markdown.bold); // prettier-ignore

export default CodeHighlightingExample;
