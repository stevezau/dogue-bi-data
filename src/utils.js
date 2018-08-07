import _ from 'lodash';
import deepEqual from 'deep-equal';
import axios from 'axios';
import Holidays from 'date-holidays/src/index';
import Moment from 'moment/moment';
import { PromisePoolExecutor } from 'promise-pool-executor';
import { extendMoment } from 'moment-range';

import { storeQuery } from './graph.schema';

export const moment = extendMoment(Moment);

axios.interceptors.response.use((response) => {
  const hrend = process.hrtime(response.config.ts);
  // console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000);
  return response;
});

const pool = new PromisePoolExecutor({
  concurrencyLimit: 20
});

export function chunkMutations(mutations, size = 5) {
  return _.chunk(mutations, size).map(chunk => `mutation {${chunk}}`);
}

export function handleError(err, store, cb) {
  if (err.message === 'captcha pending') {
    console.log(`${store} Cannot log in, waiting for captcha to resolve`);
  } else if (err.message === 'captcha required') {
    console.log(`${store} Cannot log into Mindbody due to captcha bing detected`);
  } else {
    console.log(`${store}: \n${err.stack}`);
    if (cb) {
      cb(err);
    }
  }
}

async function requestHandler(options) {
  return pool.addSingleTask({
    generator: () => new Promise((resolve, reject) => {
      axios({ ...options, ts: process.hrtime() })
        .then((res) => {
          if (res.data.errors) {
            reject(new Error(JSON.stringify(res.data.errors)));
          } else {
            resolve(res.data);
          }
        })
        .catch((err) => {
          console.log(`error response ${err}`);
          reject(err);
        });
    })
  }).promise();
}

export function mutateGraphQL(mutations, variables = {}) {
  const requests = Array.isArray(mutations) ? mutations : [mutations];
  return Promise.all(requests.map(req => requestHandler({
    url: process.env.GRAPHQL_URL,
    method: 'POST',
    data: { query: req, variables },
  })));
}

export function queryGraphQL(query, variables = {}) {
  return new Promise((resolve, reject) => {
    requestHandler({
      url: process.env.GRAPHQL_URL,
      method: 'POST',
      data: {
        query,
        variables
      }
    })
      .then(response => resolve(response.data))
      .catch(err => reject(err));
  });
}

export function getStore(name) {
  return new Promise((resolve, reject) => {
    queryGraphQL(storeQuery, { store: name })
      .then(rsp => resolve(rsp.store))
      .catch(err => reject(new Error(`Problem getting store ${name} ${err}`)));
  });
}

export function compareArrays(existingArray, newArray, key = 'uid', delId = true) {
  const existingMap = existingArray.reduce((accumulator, arr) => ({
    ...accumulator,
    [arr[key]]: arr
  }), {});

  const results = { updated: [], deleted: [], equal: [] };

  newArray.forEach((obj) => {
    const existing = existingMap[obj[key]];
    if (existing) {
      const temp = { ...existing };
      if (delId) delete temp._id; // eslint-disable-line
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

export function toCurrency(o, fixed = 2) {
  if (Number.isNaN(o)) return 0.0;
  return Number(o.toFixed(fixed));
}

export function divide(d1, d2) {
  if (d1 === 0 || d2 === 0) {
    return 0;
  }
  return toCurrency(d1 / d2);
}

export function openDays(store, from, to) {
  const holidays = new Holidays('AU', store.state);

  // Figure out the open days per month
  const days = {};
  const range = moment.range(moment(from).startOf('day'), moment(to).endOf('day'));

  for (const day of range.by('day')) {  // eslint-disable-line
    const dayName = day.format('dddd').toLowerCase();
    // Check if Open on Day
    const hol = holidays.isHoliday(day.toDate());
    const isHol = hol && hol.type !== 'bank';
    if (store.days_open.includes(dayName) && !isHol) {
      days[day.format('YYYY-MM-DD')] = { date: day };
    }
  }

  return days;
}
