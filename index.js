'use strict';

var koa = require('koa');
var koaRoute = require('koa-route');
var co = require('co');
var argparse = require('argparse');

var api = require('./lib/api.js');
var comic = require('./lib/comic.js');
var net = require('./lib/net.js');


function main (args) {
  var parser = new argparse.ArgumentParser();
  parser.addArgument(['-p', '--port'], {
    help: 'listening port',
    type: Number,
    defaultValue: 1337,
  });
  parser.addArgument(['--socks-port'], {
    help: 'SOCKS5 proxy port',
    type: Number,
    defaultValue: 0,
  });
  args = parser.parseArgs();

  var httpClient = new net.HTTPClient({
    socksPort: args.socks_port,
  });

  var comic_ = new comic.Comic({
    httpClient: httpClient,
  });

  co(function * () {
    console.info('fetching');
    yield * comic_.fetchAll();
    console.info('ok, polling');
    yield * comic_.pollAll();
    console.info('ok, updating');
    yield * comic_.getUpdates();
  }).then(() => {
    var app = koa();

    app.use(koaRoute.get('/updates', api.getUpdates));
    app.use(koaRoute.get('/comics', api.getComics));
    app.use(koaRoute.get('/comics/:comic_id', api.getComic));
    app.use(koaRoute.get('/comics/:comic_id/episodes', api.getEpisodes));
    app.use(koaRoute.get('/comics/:comic_id/episodes/:episode_id/pages', api.getPages));

    app.listen(args.port);

    console.info('listening on', args.port);
  }).catch((e) => {
    console.error(e);
    console.error(e.fileName);
    console.error(e.lineNumber);
    console.error(e.stack);
  });

  return 0;
}

if (!module.parent) {
  return main();
}
