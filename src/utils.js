import _ from 'lodash';
import deepEqual from 'deep-equal';
import request from 'request-promise-native';
import { storeQuery } from './graph.schema';

export function chunkMutations(mutations, size = 5) {
  return _.chunk(mutations, size).map(chunk => `mutation {${chunk}}`);
}

export function handleError(err, store, cb) {
  if (err.message === 'captcha pending') {
    console.log('Cannot log in, waiting for captcha to resolve');
  } else if (err.message === 'captcha required') {
    console.log(`Cannot log into Mindbody due to captcha bing detected for store ${store}`);
  } else {
    console.trace(err);
    cb(err);
  }
}

function requestHandler(options) {
  return new Promise((resolve, reject) => {
    request(options)
      .then((res) => {
        if (res.errors) {
          reject(new Error(JSON.stringify(res.errors)));
        } else {
          resolve(res);
        }
      })
      .catch((err) => {
        console.log(err);
        reject(err);
      });
  });
}

export function mutateGraphQL(mutations, variables = {}) {
  const requests = Array.isArray(mutations) ? mutations : [mutations];
  return Promise.all(requests.map(req => requestHandler({
    url: process.env.GRAPHQL_URL,
    method: 'POST',
    json: { query: req, variables },
  })));
}

export function queryGraphQL(query, variables = {}) {
  return new Promise((resolve, reject) => {
    requestHandler({
      url: process.env.GRAPHQL_URL,
      method: 'POST',
      json: {
        query,
        variables
      }
    })
      .then(response => resolve(response.data))
      .catch(err => reject(err));
  });
}

export function pagedPromise(action, resource, filter, sort, data, limit = 500) {
  const entries = [];
  let lastCount = limit;

  function loop() {
    if (lastCount < limit) {
      return Promise.resolve(entries);
    }
    const start = entries.length === 0 ? 0 : entries.length;
    return Promise.resolve(action(resource, filter, sort, data, start, limit))
      .then((results) => {
        entries.push(...results);
        lastCount = results.length;
        return Promise.resolve().then(loop);
      })
      .catch(err => Promise.reject(err));
  }

  return Promise.resolve().then(loop);
}

export function getStore(name) {
  return new Promise((resolve, reject) => {
    queryGraphQL(storeQuery, { store: name })
      .then(rsp => resolve(rsp.store))
      .catch(err => reject(new Error(`Problem getting store ${name} ${err}`)));
  });
}

export function compareArrays(existingArray, newArray, key = 'uid') {
  const existingMap = existingArray.reduce((accumulator, arr) => ({
    ...accumulator,
    [arr[key]]: arr
  }), {});

  const results = { updated: [], deleted: [], equal: [] };

  newArray.forEach((obj) => {
    const existing = existingMap[obj[key]];
    if (existing) {
      const temp = { ...existing };
      delete temp._id; // eslint-disable-line
      if (!deepEqual(obj, temp)) {
        // Has changed
        results.updated.push({ ...obj, '_id': existing._id }); // eslint-disable-line
      } else {
        // Is equal
        results.equal.push(existing);
      }
      // Delete as it's been processed
      delete existingMap[obj[key]];
    } else {
      // New object that didn't exist before.
      results.updated.push(obj);
    }
  });

  results.deleted = Object.values(existingMap);

  return results;
}

export function toCurrency(o) {
  return Number(o.toFixed(2));
}

export function divide(d1, d2) {
  if (d1 === 0 || d2 === 0) {
    return 0;
  }
  return toCurrency(d1 / d2);
}
