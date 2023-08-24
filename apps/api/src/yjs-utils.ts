import { JSDOM } from "jsdom";

import Y from "yjs";

import myspec from "./rich-schema";
import { Schema, Node as PMNode } from "prosemirror-model";
import {
  prosemirrorToYDoc,
  prosemirrorToYXmlFragment,
  yXmlFragmentToProsemirrorJSON,
} from "y-prosemirror";

const dom = new JSDOM();

function nodeName2Tag(nodeName) {
  // if (nodeName === "bold") {
  //   return "b";
  // }
  return nodeName;
}

/**
 * Parse a XML node into a Y.XmlElement or Y.XmlText. Ref:
 * https://discuss.yjs.dev/t/how-to-convert-xml-string-to-y-xmlfragment/666/2
 */
function parseNode(node) {
  if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
    const yxml = new Y.XmlElement(nodeName2Tag(node.nodeName));

    // Parse attributes
    for (let i = 0; i < node.attributes.length; i++) {
      const attribute = node.attributes[i];
      yxml.setAttribute(attribute.name, attribute.value);
    }

    // Recursively parse child nodes
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      const childYXml = parseNode(child);
      if (childYXml) {
        yxml.push([childYXml]);
      }
    }

    return yxml;
  } else if (node.nodeType === dom.window.Node.TEXT_NODE) {
    // Create a YXmlText for text nodes
    return new Y.XmlText(node.nodeValue);
  }
  throw new Error("Unknown node type");
}

/**
 * This function doesn't recover the entire yxml.
 */
function xml2yxml(xmlString) {
  const document = dom.window.document;

  // const xmlDoc = new DOMParser().parseFromString(xmlString, "text/xml");
  const xmlDoc = document.implementation.createDocument(null, null);
  const parser = new dom.window.DOMParser();
  // DOMParser expects a single root node, so we need to wrap the XML.
  const xmlDOM = parser.parseFromString(
    "<mydoc>" + xmlString + "</mydoc>",
    "text/xml"
  );
  xmlDoc.appendChild(xmlDOM.documentElement);

  const yxml = new Y.XmlFragment();
  for (let i = 0; i < xmlDoc.documentElement.childNodes.length; i++) {
    const child = xmlDoc.documentElement.childNodes[i];
    const childYXml = parseNode(child);
    if (childYXml) {
      yxml.push([childYXml]);
    }
  }
  return yxml;
}

/**
 * From prosemirror json to Y.XmlFragment.
 * @param json Parsed json object.
 * @returns
 */
export function json2yxml(json: Object) {
  const myschema = new Schema(myspec);
  const doc2 = PMNode.fromJSON(myschema, json);
  // console.log("PMDoc2", doc2);
  const yxml = prosemirrorToYXmlFragment(doc2);
  // console.log("Ydoc2", ydoc2.toJSON());
  return yxml;
}

export function yxml2json(yxml) {
  return yXmlFragmentToProsemirrorJSON(yxml);
}

/**
 * For historical reason, the backend DB schema pod.type are "CODE", "DECK",
 * "WYSIWYG", while the node types in front-end are "CODE", "SCOPE", "RICH".
 */

export function dbtype2nodetype(dbtype: string) {
  switch (dbtype) {
    case "CODE":
      return "CODE";
    case "DECK":
      return "SCOPE";
    case "WYSIWYG":
      return "RICH";
    default:
      throw new Error(`unknown dbtype ${dbtype}`);
  }
}

export function nodetype2dbtype(nodetype: string) {
  switch (nodetype) {
    case "CODE":
      return "CODE";
    case "SCOPE":
      return "DECK";
    case "RICH":
      return "WYSIWYG";
    default:
      throw new Error(`unknown nodetype ${nodetype}`);
  }
}
