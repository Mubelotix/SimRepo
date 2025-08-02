import 'webext-base-css';
import './options.css';
import { optionsStorage } from './options-storage.js';

import {EditorView, basicSetup} from "codemirror"
import {yaml} from "@codemirror/lang-yaml"
import { yamlSchema } from 'codemirror-json-schema/yaml';

const schema = {
  type: "object",
  description: "Root configuration object",
  properties: {
    example: {
      type: "boolean",
      description: "Enable or disable the example feature",
    },
  },
};

let editor = document.getElementById('editor');

const view = new EditorView({
  parent: editor,
  doc: `name: Ferdinand\nage: 93`,
  extensions: [basicSetup, yaml(), yamlSchema(schema)]
})

console.log("successfully loaded options.js");
