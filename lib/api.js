'use strict';

var db = require('./db.js');


function * getUpdates (next) {
  if (this.method !== 'GET') {
    return yield next;
  }

  var offset = typeof this.query.offset === 'undefined' ? 0 : parseInt(this.query.offset, 10);
  var length = typeof this.query.length === 'undefined' ? 0 : parseInt(this.query.length, 10);

  var db_ = yield db.getInstance();
  var comics = yield db_.getLatestComics(offset, length);
  this.body = comics;
}


function * getComics (next) {
  if (this.method !== 'GET') {
    return yield next;
  }

  var offset = typeof this.query.offset === 'undefined' ? 0 : parseInt(this.query.offset, 10);
  var length = typeof this.query.length === 'undefined' ? 0 : parseInt(this.query.length, 10);

  var db_ = yield db.getInstance();
  var comics = yield db_.getComics(offset, length);
  this.body = comics;
}


function * getComic (comicID, next) {
  if (this.method !== 'GET') {
    return yield next;
  }

  var db_ = yield db.getInstance();
  var comic = yield db_.getComic(comicID);
  this.body = comic;
}


function * getEpisodes (comicID, next) {
  if (this.method !== 'GET') {
    return yield next;
  }

  var db_ = yield db.getInstance();
  var episodes = yield db_.getEpisodes(comicID);
  this.body = episodes;
}


function * getPages (comicID, episodeID, next) {
  if (this.method !== 'GET') {
    return yield next;
  }

  var db_ = yield db.getInstance();
  var pages = yield db_.getPages(episodeID);
  this.body = pages;
}


// internal API
function * postComic (comicID, next) {
  if (this.method !== 'POST') {
    return yield next;
  }
  yield * this.comic.fetchComic(comicID);
  this.body = '\n';
}


function * patchEpisode (comicID, episodeID, next) {
  if (this.method !== 'PATCH') {
    return yield next;
  }
  yield * this.comic.replaceEpisode(comicID, episodeID);
  this.body = '\n';
}


module.exports = {
  getUpdates: getUpdates,
  getComics: getComics,
  getComic: getComic,
  getEpisodes: getEpisodes,
  getPages: getPages,
  postComic: postComic,
};
