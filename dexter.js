var BASE_URL = 'https://example-provider.com';
var USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Find <meta name="<metaName>" content="..."> regardless of attribute order/quotes. */
function getMetaContent(html, metaName) {
  var tagRe = /<meta\b[^>]*>/gi;
  var nameRe = new RegExp('\\bname\\s*=\\s*["\']' + metaName + '["\']', 'i');
  var contentRe = /\bcontent\s*=\s*["']([^"']*)["']/i;
  var tag;

  while ((tag = tagRe.exec(html)) !== null) {
    if (nameRe.test(tag[0])) {
      var content = contentRe.exec(tag[0]);
      if (content && content[1]) return content[1];
    }
  }
  return null;
}

/** Normalize a host string to "https://host" with no trailing slash, or null. */
function normalizeServer(raw) {
  if (!raw) return null;
  var host = String(raw).split(',')[0].trim();
  if (!host || /\s/.test(host)) return null;
  if (!/^https?:\/\//i.test(host)) host = 'https://' + host;
  return host.replace(/\/+$/, '');
}

function buildTargetUrl(id, mediaType, seasonNum, episodeNum) {
  var safeId = encodeURIComponent(String(id));
  var isSeries = mediaType === 'tv' || mediaType === 'series';

  if (!isSeries) return BASE_URL + '/movie/' + safeId;

  var season = parseInt(seasonNum, 10);
  var episode = parseInt(episodeNum, 10);
  if (isNaN(season) || isNaN(episode)) return null;

  return BASE_URL + '/tv/' + safeId + '/season/' + season + '/episode/' + episode;
}

function getStreams(id, mediaType, seasonNum, episodeNum) {
  // Promise.resolve().then(...) ensures even synchronous throws reach .catch()
  return Promise.resolve()
    .then(function () {
      if (id === undefined || id === null || id === '') return [];

      var targetUrl = buildTargetUrl(id, mediaType, seasonNum, episodeNum);
      if (!targetUrl) return [];

      return fetch(targetUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': BASE_URL + '/' }
      })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.text();
        })
        .then(function (html) {
          if (!html) return [];

          var primaryServer = normalizeServer(getMetaContent(html, 'config:server'));
          if (!primaryServer) return [];

          var idMatch = html.match(/\/watch\/(\d+-[a-zA-Z0-9-]+)/i);
          var contentSlug = idMatch ? idMatch[1] : encodeURIComponent(String(id));

          return [{
            name: 'Default Stream',
            title: 'Auto HD - HLS Stream',
            url: primaryServer + '/v/' + contentSlug + '/master.m3u8',
            quality: 'auto',
            format: 'm3u8',
            headers: {
              'User-Agent': USER_AGENT,
              'Referer': BASE_URL + '/watch/' + contentSlug
            }
          }];
        });
    })
    .catch(function () {
      return []; // fail-safe: let the app fall through to the next provider
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
}
