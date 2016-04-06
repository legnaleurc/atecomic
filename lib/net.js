'use strict';

var fetch = require('node-fetch');
var jsdom = require('jsdom');
var Agent = require('socks5-http-client/lib/Agent');


function httpGet (url) {
  return fetch(url, {
    agent: new Agent({
      socksPort: 12345,
    }),
  });
}


function getPage (url) {
  return httpGet(url).then((response) => {
    return response.text();
  }).then((html) => {
    var document = jsdom.jsdom(html);
    return document;
  });
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
  getPage: getPage,
};
