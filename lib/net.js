'use strict';

var fetch = require('node-fetch');
var jsdom = require('jsdom');
var Agent = require('socks5-http-client/lib/Agent');


function HTTPClient (options) {
  var _ = this._ = {};
  _.fetchOptions = undefined;
  if (options.socksPort > 0) {
    _.fetchOptions = {
      agent: new Agent({
        socksPort: options.socksPort,
      }),
    };
  }
}

HTTPClient.prototype.getDOM = function getDOM (url) {
  return httpGet(this, url).then((response) => {
    return response.text();
  }).then((html) => {
    var document = jsdom.jsdom(html);
    return document;
  });
};


function httpGet (that, url) {
  return fetch(url, that._.fetchOptions);
}


function main () {
  return httpGet('http://www.comicbus.com/comic/all.html').then((response) => {
    return response.text();
  }).then((html) => {
    console.info(html.length);
    return 0;
  }).catch((e) => {
    console.error(e);
  });
}


if (!module.parent) {
  return main().catch((e) => {
    console.error(e);
  });
}


module.exports = {
  HTTPClient: HTTPClient,
};
