const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distributionDir = path.join(__dirname, '../distribution');
const manifestPath = path.join(distributionDir, 'manifest.json');

// Find options.html file
const files = fs.readdirSync(distributionDir);
const optionsHtmlFile = files.find(file => file.startsWith('options.') && file.endsWith('.html'));

if (!optionsHtmlFile) {
    console.error('Could not find options.html in distribution directory');
    process.exit(1);
}

const optionsHtmlPath = path.join(distributionDir, optionsHtmlFile);
const htmlContent = fs.readFileSync(optionsHtmlPath, 'utf8');

// Extract import map content
const importMapMatch = htmlContent.match(/<script type=["']?importmap["']?>(.*?)<\/script>/s);

if (importMapMatch && importMapMatch[1]) {
    const importMapContent = importMapMatch[1];
    const hash = crypto.createHash('sha256').update(importMapContent).digest('base64');
    const cspHash = `'sha256-${hash}'`;

    console.log(`Found inline import map. Hash: ${cspHash}`);

    // Update manifest.json
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (!manifest.content_security_policy) {
        manifest.content_security_policy = {};
    }

    if (!manifest.content_security_policy.extension_pages) {
        manifest.content_security_policy.extension_pages = "script-src 'self'; object-src 'self'";
    }

    // Add hash to script-src
    let csp = manifest.content_security_policy.extension_pages;
    if (csp.includes("script-src")) {
        csp = csp.replace("script-src", `script-src ${cspHash}`);
    } else {
        csp = `${csp}; script-src ${cspHash}`;
    }

    manifest.content_security_policy.extension_pages = csp;

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));
    console.log('Updated manifest.json with CSP hash');
} else {
    console.log('No inline import map found in options.html');
}
