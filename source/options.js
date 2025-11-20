import { optionsStorage } from './options-storage.js';
import { basicSetup } from "codemirror"
import { EditorView, keymap } from "@codemirror/view"
import { yaml } from "@codemirror/lang-yaml"
import { yamlSchema } from 'codemirror-json-schema/yaml';
import { indentWithTab } from "@codemirror/commands"
import YAML from 'yaml';

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
                },
                count: {
                    type: "integer",
                    description: "Number of similar items to show",
                    minimum: 1,
                },
                // showArchived: {
                //   type: "boolean",
                //   description: "Whether to include archived repositories in the list of similar projects",
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
                },
                count: {
                    type: "integer",
                    description: "Number of items to display on the homepage",
                    maximum: 150,
                },
                starsToLoad: {
                    type: "integer",
                    description: "Number of your latest stars to load in order to provide you recommendations. Since repositories with less than 150 stars won't be used, the actual number may be less. Stars are loaded 30 by 30 so this would benefit being a multiple of 30.",
                    minimum: 1,
                    maximum: 120,
                },
                poolSize: {
                    type: "number",
                    description: "Size ratio of a pool against the count of recommendations shown. Recommendations are randomly selected from the pool. If you find the homepage recommendations to be too repetitive, increase this value.",
                    minimum: 1.0,
                    maximum: 10.0,
                },
                //   type: "boolean",
                //   description: "Whether to include archived repositories in the homepage recommendations",
                // },
                redirectToFeed: {
                    type: "boolean",
                    description: "Automatically redirect from the homepage to the feed page",
                },
            },
            required: [],
        },

    },
    required: [],
};

let editor = document.getElementById('editor');

async function defaultCode() {
    let options = await optionsStorage.getAll();
    console.log("Default options:", options);

    let code = "# Welcome the SimRepo's options\n# If you want to reset options, just clear everything and the default configuration will be restored.\n# Options are saved automatically, but comments will be ignored\n# Options are experimental, feel free to open issues on GitHub if you find any\n\n"
    for (const [key, prop] of Object.entries(schema.properties)) {
        code += `\n# ${prop.description}\n${key}:\n`;
        for (const [subKey, subProp] of Object.entries(prop.properties)) {
            let value = null;
            switch (`${key}.${subKey}`) {
                case "similar.enabled":
                    value = options.similarEnabled;
                    break;
                case "similar.count":
                    value = options.similarCount;
                    break;
                case "homepage.enabled":
                    value = options.homepageEnabled;
                    break;
                case "homepage.count":
                    value = options.homepageCount;
                    break;
                case "homepage.starsToLoad":
                    value = options.homepageStarsToLoad;
                    break;
                case "homepage.poolSize":
                    value = options.homepagePoolSize;
                    break;
                case "homepage.redirectToFeed":
                    value = options.homepageRedirectToFeed;
                    break;
                default:
                    value = "Unknown value. Open an issue on GitHub if you see this.";
            }
            code += `  # ${subProp.description}\n  ${subKey}: ${value}\n\n`;
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

let changed = false;
let saveTimeout = null;
const autoSave = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
        document.title = "Options (unsaved)";
        changed = true;
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveIfChanged();
            saveTimeout = null;
        }, 1000); // 1 second after last edit
    }
});

async function saveIfChanged() {
    if (changed) {
        const doc = view.state.doc.toString();
        try {
            const parsed = YAML.parse(doc);
            await optionsStorage.set({
                optionsYaml: doc,
                similarEnabled: parsed.similar?.enabled ?? optionsStorage.defaults.similarEnabled,
                similarCount: parsed.similar?.count ?? optionsStorage.defaults.similarCount,
                homepageEnabled: parsed.homepage?.enabled ?? optionsStorage.defaults.homepageEnabled,
                homepageCount: parsed.homepage?.count ?? optionsStorage.defaults.homepageCount,
                homepageStarsToLoad: parsed.homepage?.starsToLoad ?? optionsStorage.defaults.homepageStarsToLoad,
                homepagePoolSize: parsed.homepage?.poolSize ?? optionsStorage.defaults.homepagePoolSize,
                homepageRedirectToFeed: parsed.homepage?.redirectToFeed ?? optionsStorage.defaults.homepageRedirectToFeed,
            });

            let options = await optionsStorage.getAll();
            console.log("Settings saved:", options);

            changed = false;
            document.title = "Options";
        } catch (e) {
            console.error("YAML parse error — not saving:", e.message);
        }
    }
}

window.addEventListener("beforeunload", () => {
    saveIfChanged();
});

var view = null;
async function init() {
    view = new EditorView({
        parent: editor,
        doc: await defaultCode(),
        extensions: [basicSetup, keymap.of([indentWithTab]), resetOnEmpty, autoSave, EditorView.lineWrapping, yaml(), yamlSchema(schema)]
    })
}

init();
