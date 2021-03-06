'use strict';

var url = require('url');

var net = require('./net.js');
var db = require('./db.js');
var asyncio = require('./asyncio.js');


function Comic (options) {
  var _ = this._ = {};
  _.curl = (options && options.httpClient) || new net.HTTPClient();
}

Comic.prototype.fetchUpdates = function * fetchUpdates () {
  let comicList = [];
  for (let i = 1; i <= 5; ++i) {
    comicList = comicList.concat(yield * getUpdatesByPage(this, i));
  }
  // TODO unique

  var db_ = yield db.getInstance();
  yield db_.addRefreshTasks(comicList, true);
};

Comic.prototype.fetchAll = function * fetchAll () {
  var pageURL = 'http://www.comicbus.com/comic/all.html';
  var all = yield this._.curl.getDOM(pageURL);
  all = all.querySelectorAll('table[id] > tbody > tr > td > a');
  all = Array.prototype.map.call(all, (a) => {
    return {
      original_id: getComicIDFromURL(a.href),
      url: url.resolve(pageURL, a.href),
    };
  });

  var db_ = yield db.getInstance();
  yield db_.addRefreshTasks(all);
}

Comic.prototype.fetchComic = function * fetchComic (comicID) {
  var db_ = yield db.getInstance();

  var comic = yield db_.getRefreshDescriptor(comicID);
  yield db_.addRefreshTasks([comic], true);
}

Comic.prototype.process = function * process () {
  var db_ = yield db.getInstance();

  var tasks = yield db_.getDirtyRefreshTasks();
  var that = this;
  yield asyncio.forEach(tasks, function * (comic, index, self) {
    console.info(comic, index, self.length, index / self.length);
    try {
      comic = yield * fetchComicByOriginalID(that, comic);
    } catch (e) {
      console.error(e, comic);
      return;
    }
    console.info(comic);
    yield db_.updateComic(comic);
  });
}


Comic.prototype.replaceEpisode = function * (comicID, episodeID) {
  var db_ = yield db.getInstance();

  yield db_.deletePagesByEpisode(episodeID);
  yield db_.deleteEpisode(episodeID);
  yield db_.addRefreshTasks([comicID], true);
};


function * getUpdatesByPage (that, page) {
  var rootURL = `http://www.comicbus.com/comic/u-${page}.html`;
  var html = yield that._.curl.getDOM(rootURL);
  var tmp = html.querySelector('body > table:nth-child(5) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1)');
  tmp = tmp.querySelectorAll('a');

  var comicList = Array.prototype.map.call(tmp, (a) => {
    var pageURL = url.resolve(rootURL, a.href);
    var id = getComicIDFromURL(pageURL);
    return {
      original_id: id,
      url: pageURL,
    };
  });

  return comicList;
}


function getComicIDFromURL (pageURL) {
  var id = pageURL.match(/\/(\d+)\.html$/);
  id = id ? id[1] : '0';
  return parseInt(id, 10);
}


function * fetchComicByOriginalID (that, comic) {
  var html = yield that._.curl.getDOM(comic.url);
  var parsed = {
    original_id: comic.original_id,
    url: comic.url,
    title: parseTitle(html),
    coverURL: parseCoverURL(html, comic.url),
    author: parseAuthor(html),
    mtime: parseMTime(html),
    brief: parseBrief(html),
  };
  parsed.episodes = yield * parseEpisodeList(that, html, comic.url);
  return parsed;
}


function parseTitle (comicMainPage) {
  var node = comicMainPage.querySelector('body > table:nth-child(8) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1) > font:nth-child(2)');
  return node.textContent.trim();
}


function parseCoverURL (comicMainPage, comicURL) {
  var node = comicMainPage.querySelector('body > table:nth-child(8) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(3) > table:nth-child(2) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1) > img:nth-child(1)');
  return url.resolve(comicURL, node.src);
}


function parseAuthor (comicMainPage) {
  var node = comicMainPage.querySelector('body > table:nth-child(8) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(3) > table:nth-child(2) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2)');
  return node.textContent.trim();
}


function parseMTime (comicMainPage) {
  var node = comicMainPage.querySelector('body > table:nth-child(8) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(3) > table:nth-child(2) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(5) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2)');
  var m = node.textContent.match(/^(\d\d\d\d)-(\d\d)-(\d\d)$/);
  m = m.slice(1).map((s) => {
    return parseInt(s, 10);
  });
  var date = new Date(m[0], m[1] - 1, m[2]);
  return date;
}


function parseBrief (comicMainPage) {
  var node = comicMainPage.querySelector('body > table:nth-child(8) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(3) > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1)');
  return node.textContent.trim();
}


function * parseEpisodeList (that, comicMainPage, comicURL) {
  var chapterFromPage = new Map();
  var volumeLinks = yield * parseEpisodeListByCategory(that, comicMainPage, comicURL, 'a.Vol', chapterFromPage);
  volumeLinks = volumeLinks.map((episode) => {
    episode.isVolume = true;
    episode.isChapter = false;
    return episode;
  });
  var chapterLinks = yield * parseEpisodeListByCategory(that, comicMainPage, comicURL, 'a.Ch', chapterFromPage);
  chapterLinks = chapterLinks.map((episode) => {
    episode.isVolume = false;
    episode.isChapter = true;
    return episode;
  });

  return volumeLinks.concat(chapterLinks);
}


function * parseEpisodeListByCategory (that, comicMainPage, comicURL, selector, chapterFromPage) {
  var links = comicMainPage.querySelectorAll(selector);
  links = Array.prototype.slice.call(links);

  links = yield asyncio.map(links, function * (anchor) {
    var name = anchor.textContent;
    var mtime = 0;
    var font = anchor.querySelector('font');
    if (font) {
      name = font.textContent;
      let script = anchor.querySelector('script');
      script = script.textContent;
      script = script.match(/isnew\('([^']*)','[^']*',(\d+)\)/);
      if (script) {
        let dd = script[1];
        mtime = isnew(dd);
      }
    }

    var action = anchor.getAttribute('onClick');
    action = action.match(/cview\('([^']+)',(\d+),(\d+)\)/);
    var detail = cview(action[1], parseInt(action[2], 10));
    var pageFunction = yield * getPageFunction(that, chapterFromPage, detail.commonURL);
    var pages = pageFunction(detail.ch);

    return {
      id: parseInt(detail.ch, 10),
      title: name.trim(),
      mtime: mtime,
      url: detail.url,
      pages: pages,
    };
  });

  return links;
}


function * getPageFunction (that, chapterFromPage, pageURL) {
  if (chapterFromPage.has(pageURL)) {
    return chapterFromPage.get(pageURL);
  }

  var html = yield that._.curl.getDOM(pageURL);
  var scripts = html.querySelectorAll('script');
  var script = Array.prototype.find.call(scripts, function (script) {
    return script.textContent.indexOf('sp%28%29') >= 0;
  });
  if (!script) {
    return null;
  }

  script = script.textContent;
  var chs = script.match(/var chs=(\d+);/);
  var ti = script.match(/var ti=(\d+);/);
  var cs = script.match(/var cs='([^\']+)';/);
  if (!chs || !ti || !cs) {
    return null;
  }

  chs = chs[1];
  ti = ti[1];
  cs = cs[1];

  var fn = (ch) => {
    return sp(cs, chs, ch, ti);
  };
  chapterFromPage.set(pageURL, fn);
  return fn;
}


function main () {
  var co = require('co');

  return co(function * () {
    var that = new Comic({});
    var comic = {
      url: 'http://www.comicbus.com/html/13899.html',
    };
    comic = yield * fetchComicByOriginalID(that, comic);
    console.info(comic);
  });
/*
  var a = new Comic({});
  var chapterFromPage = new Map();
  var detail = cview('13143-17.html', 6);
  return co(function * () {
    var pageFunction = yield * getPageFunction(a, chapterFromPage, detail.commonURL);
    var pages = pageFunction(detail.ch);
    console.info(pages);
  });
*/

  // co(function * () {
  //   yield * fetchAll();
  //   yield * pollAll();
  //   yield * getUpdates();
  // }).then(() => {
  // }).catch((e) => {
  //   throw e;
  // });
}


// translated from 8comic
function isnew (dd) {
  dd = dd.split('-').map((s) => {
    return parseInt(s, 10);
  });
  return new Date(dd[0], dd[1], dd[2]);
}


function cview (episodePath, catid) {
  var baseURL = 'http://v.comicbus.com/online/comic-';

  var part = episodePath.replace('.html', '').split('-');
  var commonURL = baseURL + part[0] + '.html';
  var ch = part[1];

  return {
    url: commonURL + '?ch=' + ch,
    commonURL: commonURL,
    ch: ch,
  };
}


// cs: chapter information
// chs: total page count
// ch: current episode
// ti: unknown
function sp (cs, chs, ch, ti) {
  var f = 50;
  var c = '';
  var ps = ''; // total page count

  var cc = cs.length;
  for (let i = 0; i < cc / f; i++) {
    if (ss(cs, i * f, 4) == ch) {
      c = ss(cs, i * f, f, f);
      break;
    }
  }
  if (c == '') {
    c = ss(cs, cc - f, f);
    ch = chs;
  }
  ps = ss(c, 7, 3);
  ps = parseInt(ps, 10);
  var a = [];
  for (let p = 1; p <= ps; ++p) {
    a.push(si(c, ti, p, f));
  }
  return a;
}


function ss (a, b, c, d) {
  var e = a.substring(b, b + c);
  return d == null ? e.replace(/[a-z]*/gi, "") : e;
}


function si (c, ti, p, f) {
  return 'http://img' + ss(c, 4, 2) + '.6comic.com:99/' + ss(c, 6, 1) + '/' + ti + '/' + ss(c, 0, 4) + '/' + nn(p) + '_' + ss(c, mm(p) + 10, 3, f) + '.jpg';
}


function nn (n) {
  return n < 10 ? '00' + n : n < 100 ? '0' + n : n;
}


function mm (p) {
  return (parseInt((p - 1) / 10) % 10) + (((p - 1) % 10) * 3);
}
// end


if (!module.parent) {
  return main().catch(function (e) {
    console.error(e);
  });
}


module.exports = {
  Comic: Comic,
};
