import OptionsSync from 'webext-options-sync';

const optionsStorage = new OptionsSync({
    defaults: {
        optionsYaml: "",

        similarEnabled: true,
        similarCount: 5,
        // similarShowArchived: true,

        homepageEnabled: true,
        homepageCount: 25,
        homepageStarsToLoad: 60,
        poolSize: 3.0,
        // homepageShowArchived: true,
    },
    migrations: [
        OptionsSync.migrations.removeUnused,
    ],
    logging: true,
});

export { optionsStorage };
