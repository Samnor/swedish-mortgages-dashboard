function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var prefixes = ['/mortgages', '/mortgages-dev'];

  for (var i = 0; i < prefixes.length; i++) {
    var prefix = prefixes[i];

    if (uri === prefix + '/locale.json') {
      var countryHeader = request.headers['cloudfront-viewer-country'];
      var countryCode = countryHeader ? countryHeader.value : '';
      var locale = countryCode === 'SE' ? 'sv' : 'en';

      return {
        statusCode: 200,
        statusDescription: 'OK',
        headers: {
          'cache-control': { value: 'private, max-age=300' },
          'content-type': { value: 'application/json; charset=utf-8' },
          vary: { value: 'CloudFront-Viewer-Country' }
        },
        body: {
          encoding: 'text',
          data: JSON.stringify({ locale: locale, country: countryCode || null })
        }
      };
    }

    if (uri === prefix || uri === prefix + '/') {
      request.uri = prefix + '/index.html';
      return request;
    }
    if (uri.indexOf(prefix + '/') === 0 && uri.indexOf('.', uri.lastIndexOf('/')) === -1) {
      request.uri = prefix + '/index.html';
      return request;
    }
  }

  return request;
}
