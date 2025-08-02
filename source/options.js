import 'webext-base-css';
import './options.css';
import { optionsStorage } from './options-storage.js';

import {EditorView, basicSetup} from "codemirror"
import {yaml} from "@codemirror/lang-yaml"

let editor = document.getElementById('editor');

const view = new EditorView({
  parent: editor,
  doc: `name: Ferdinand\nage: 93`,
  extensions: [basicSetup, yaml()]
})

console.log("successfully loaded options.js");
