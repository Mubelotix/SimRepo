import Document, { Html, Head, Main, NextScript } from 'next/document';

const legacyHashRedirect = `
    (function () {
        if (window.location.pathname !== "/") return;
        var values = window.location.hash.slice(1).split("&").filter(Boolean);
        var repo = values.shift();
        if (!repo) return;

        try {
            repo = decodeURIComponent(repo);
        } catch {
            return;
        }

        var segments = repo.split("/");
        if (segments.length !== 2 || !segments[0] || !segments[1]) return;

        var query = [];
        values.forEach(function (rawValue) {
            var value;
            try {
                value = decodeURIComponent(rawValue);
            } catch {
                return;
            }

            if (value === "timeline" || value === "Timeline" || value === "type=timeline") {
                query.push("type=timeline");
            } else if (value === "logscale" || value === "LogScale") {
                query.push("logscale");
            } else if (value === "legend=bottom-right") {
                query.push("legend=bottom-right");
            } else if (value === "style=github") {
                query.push("style=github");
            } else if (value.includes("/")) {
                query.push("compare=" + encodeURIComponent(value).replace(/%2F/g, "/"));
            }
        });

        var target = "/" + encodeURIComponent(segments[0]) + "/" + encodeURIComponent(segments[1]);
        if (query.length > 0) target += "?" + query.join("&");
        window.location.replace(target);
    })();
`;

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en"> {/* Set your desired language here */}
        <Head>
          <link rel="search" type="application/opensearchdescription+xml" title="GitHub Star History" href="/opensearch.xml" />
          <script dangerouslySetInnerHTML={{ __html: legacyHashRedirect }} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
