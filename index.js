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

  var server = koa();

  server.use(koaRoute.get('/updates', api.getUpdates));
  server.use(koaRoute.get('/comics', api.getComics));
  server.use(koaRoute.get('/comics/:comic_id', api.getComic));
  server.use(koaRoute.get('/comics/:comic_id/episodes', api.getEpisodes));
  server.use(koaRoute.get('/comics/:comic_id/episodes/:episode_id/pages', api.getPages));

  server.listen(args.port);
  console.info('listening on', args.port);

  co(function * () {
    console.info('fetching');
    yield * comic_.fetchAll();

    var handle = setInterval(() => {
      co(function * () {
        console.info('updating');
        yield * comic_.fetchUpdates();
      });
    }, 1000 * 60 * 60);

    console.info('polling');
    while (true) {
      yield * comic_.process();
    }
  }).then(() => {
    console.info('ok');
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
