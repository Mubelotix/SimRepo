import 'webext-base-css';
import './options.css';
import { optionsStorage } from './options-storage.js';

import { basicSetup } from "codemirror"
import { EditorView, keymap } from "@codemirror/view"
import { yaml } from "@codemirror/lang-yaml"
import { yamlSchema } from 'codemirror-json-schema/yaml';
import { indentWithTab } from "@codemirror/commands"

const schema = {
    type: "object",
    description: "Extension settings",
    properties: {
        similar: {
            type: "object",
            description: "Settings for showing similar projects in the sidebar of a repository.",
            properties: {
                enabled: {
                    type: "boolean",
                    description: "Whether to show similar repositories",
                    default: true,
                },
                count: {
                    type: "integer",
                    description: "Number of similar items to show",
                    default: 5,
                    minimum: 1,
                },
                // showArchived: {
                //   type: "boolean",
                //   description: "Whether to include archived repositories in the list of similar projects",
                //   default: true,
                // },
            },
            required: [],
        },
        homepage: {
            type: "object",
            description: "Settings for homepage recommendations",
            properties: {
                enabled: {
                    type: "boolean",
                    description: "Enable or disable the homepage feature",
                    default: true,
                },
                count: {
                    type: "integer",
                    description: "Number of items to display on the homepage. Since they are loaded 30 by 30, this would benefit being a multiple of 30.",
                    default: 90,
                    minimum: 1,
                },
                poolSize: {
                    type: "number",
                    description: "Size ratio of a pool against the count of recommendations shown. Recommendations are randomly selected from the pool. If you find the homepage recommendations to be too repetitive, increase this value.",
                    default: 3.0,
                    minimum: 1.0,
                    maximum: 10.0,
                },
                // showArchived: {
                //   type: "boolean",
                //   description: "Whether to include archived repositories in the homepage recommendations",
                //   default: false,
                // },
            },
            required: [],
        },
    },
    required: [],
};

let editor = document.getElementById('editor');

function defaultCode() {
    let code = "# Welcome the SimRepo's settings\n# See the readme for a complete example of a valid config\n# If you want to reset settings, just clear everything and the default configuration will be restored.\n# Settings are saved automatically\n\n"
    for (const [key, prop] of Object.entries(schema.properties)) {
        code += `\n# ${prop.description}\n${key}:\n`;
        for (const [subKey, subProp] of Object.entries(prop.properties)) {
            code += `  # ${subProp.description}\n  ${subKey}: ${JSON.stringify(subProp.default)}\n\n`;
        }
    }
    return code;
}

const resetOnEmpty = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
        const currentContent = update.state.doc.toString().trim();
        if (currentContent === "") {
            // Reset the editor content to default
            update.view.dispatch({
                changes: { from: 0, to: 0, insert: defaultCode() },
            });
        }
    }
});

const view = new EditorView({
    parent: editor,
    doc: defaultCode(),
    extensions: [basicSetup, keymap.of([indentWithTab]), resetOnEmpty, EditorView.lineWrapping, yaml(), yamlSchema(schema)]
})

console.log("successfully loaded options.js");
