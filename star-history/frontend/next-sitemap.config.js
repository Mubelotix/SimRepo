module.exports = {
    siteUrl: 'https://star-history.dera.page',
    outDir: 'out',
    generateRobotsTxt: true,
    robotsTxtOptions: {
        policies: [
            { userAgent: '*', disallow: '/_next/' },
            { userAgent: '*', disallow: '/embed' },
        ],
    },
};
  