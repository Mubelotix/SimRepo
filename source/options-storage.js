import OptionsSync from 'webext-options-sync';

const optionsStorage = new OptionsSync({
    defaults: {
        similarEnabled: true,
        similarCount: 5,
        // similarShowArchived: true,

        homepageEnabled: true,
        homepageCount: 90,
        poolSize: 3.0,
        // homepageShowArchived: true,
    },
    migrations: [
        OptionsSync.migrations.removeUnused,
    ],
    logging: true,
});

export { optionsStorage };
