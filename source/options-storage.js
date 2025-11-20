import OptionsSync from 'webext-options-sync';

const optionsStorage = new OptionsSync({
    defaults: {
        optionsYaml: "",

        similarEnabled: true,
        similarCount: 5,
        similarShowUnavailable: true,
        // similarShowArchived: true,

        homepageEnabled: true,
        homepageCount: 25,
        homepageStarsToLoad: 60,
        homepagePoolSize: 3.0,
        // homepageShowArchived: true,
        homepageRedirectToFeed: false,
    },
    migrations: [
        OptionsSync.migrations.removeUnused,
    ],
    logging: true,
});

export { optionsStorage };
