// Yay! reinvent the hell fucking wheel
'use strict';

var co = require('co');


function forEach (array, generator) {
  return co(function * () {
    for (let index = 0; index < array.length; ++index) {
      if (array.hasOwnProperty(index)) {
        yield * generator(array[index], index, array);
      }
    }
  });
}


function map (array, generator) {
  return co(function * () {
    let newArray = [];
    for (let index = 0; index < array.length; ++index) {
      if (array.hasOwnProperty(index)) {
        let rv = yield * generator(array[index], index, array);
        newArray.push(rv);
      }
    }
    return newArray;
  });
}


// WARNING this is slow if array is large
// because it builds all promises at once
function forEachSlow (array, generator) {
  return array.reduce((previous, current, index, self) => {
    return previous.then(() => {
      return co(function * () {
        yield * generator(current, index, self);
      });
    });
  }, Promise.resolve());
}


// WARNING this is slow if array is large
// because it builds all promises at once
function mapSlow (array, generator) {
  return array.reduce((previous, current, index, self) => {
    return previous.then((newArray) => {
      return co(function * () {
        var rv = yield * generator(current, index, self);
        newArray.push(rv);
        return newArray;
      });
    });
  }, Promise.resolve([]));
}


function waitAsPromise (msDelay, payload) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(payload);
    }, msDelay);
  });
}


function * waitAsGenerator (msDelay, payload) {
  return yield waitAsPromise(msDelay, payload);
}


function main () {
  co(function * () {
    var a = [];
    console.time('loop');
    for (let i = 0; i < 100000; ++i) {
      a.push(waitAsPromise(1, i));
    }
    console.timeEnd('loop');

    console.time('first generator');
    var first = false;
    yield forEach(a, function * (value, index, self) {
      if (!first) {
        console.timeEnd('first generator');
        first = true;
      }
      yield value;
    });

    yield forEach([1, 2, 3, 4], function * (value, index, self) {
      console.info('wait as promise');
      var rv = yield waitAsPromise(1000, value);
      console.info('ok', value, index, self, rv);
      console.info('wait as generator');
      rv = yield * waitAsGenerator(1000, value);
      console.info('ok', value, index, self, rv);
    });

    var k = yield map([1, 2, 3, 4], function * (value, index, self) {
      console.info('wait as promise');
      var rv = yield waitAsPromise(1000, value);
      console.info('ok', value, index, self, rv);
      console.info('wait as generator');
      rv = yield * waitAsGenerator(1000, value);
      console.info('ok', value, index, self, rv);
      return rv * 2;
    });

    return k;
  }).then((rv) => {
    console.info('done', rv);
  }).catch((e) => {
    console.warn(e);
  });
}


if (!module.parent) {
  return main();
}


module.exports = {
  forEach: forEach,
  map: map,
};
