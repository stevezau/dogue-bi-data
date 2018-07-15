import Moment from 'moment';
import { extendMoment } from 'moment-range';
import XLSX from 'xlsx';
import { toCurrency, queryGraphQL, mutateGraphQL, getStore, openDays } from '../src/utils';

const moment = extendMoment(Moment);

const dollarRegex = /[%$,]/g;

const workbook = XLSX.readFile('./targets.xlsx');

export const targetYearQuery = `
  query target($store: String!, $year: Int!) {
    target(store: $store, year: $year) {
      _id
    }
  }`;

function getTargets(sheet) {
  return XLSX.utils.sheet_to_json(sheet).map(row => ({
    month: moment(row.month, 'YYYY-MMM'),
    total: row.total ? Number(row.total.replace(dollarRegex, '')) : 0,
    retail: row.retail ? Number(row.retail.replace(dollarRegex, '')) : 0,
    grooming: row.grooming ? Number(row.grooming.replace(dollarRegex, '')) : 0,
    daycare: row.daycare ? Number(row.daycare.replace(dollarRegex, '')) : 0
  }));
}

function getAttr(obj, key, defValue) {
  if (!obj.hasOwnProperty(key)) {
    obj[key] = defValue;
  }
  return obj[key];
}

function targetMutation(store, year, data, targetId) {
  const update = targetId ? `id: "${targetId}"` : '';
  const action = targetId ? 'update' : 'add';

  const weeks = Object.entries(data.weeks).map(([w, d]) => `w${w}: {days_open: ${d.days_open}, total: ${d.total}, retail: ${d.retail}, daycare: ${d.daycare}, grooming: ${d.grooming}}\n`);

  const months = Object.values(data.months).map((d) => {
    const monthName = d.date.format('MMM').toLowerCase();
    return `${monthName}: {days_open: ${d.days_open}, total: ${d.total}, retail: ${d.retail}, daycare: ${d.daycare}, grooming: ${d.grooming}}\n`;
  });

  return `
    mutation {
      ${action}Target(
        ${update}
        target: {
          store: "${store.name}",
          year: ${year},
          weeks:{
            ${weeks.join(' ')}
          }
          months:{
            ${months.join(' ')}
          }
        }
    ) {
      _id
    }
  }`;
}

async function processStore(store, targets) {
  console.log(`Process targets for store ${store.name}`);

  // Sort targets, oldest month first
  targets.sort((a, b) => a.month - b.month);

  const years = {};

  // Figure out the targets by year, month incl holidays
  for (const target of targets) {  // eslint-disable-line
    const targetYear = target.month.year();
    const targetMonth = target.month.month() + 1;
    const year = getAttr(years, targetYear, { months: {}, weeks: {} });
    const month = {
      date: target.month,
      total: target.total,
      retail: target.retail,
      grooming: target.grooming,
      daycare: target.daycare,
      days: {}
    };
    year.months[targetMonth] = month;

    // Figure out the open days per month
    month.days = openDays(store, moment(target.month).startOf('month'), moment(target.month).endOf('month'));

    // Figure out the daily targets
    month.days_open = Object.keys(month.days).length;
    const dailyTotal = month.total / month.days_open;
    const dailyRetail = month.retail / month.days_open;
    const dailyGrooming = month.grooming / month.days_open;
    const dailyDaycare = month.daycare / month.days_open;

    // Update days with targets and add to week
    for (const day of Object.values(month.days)) { // eslint-disable-line
      day.total = dailyTotal;
      day.retail = dailyRetail;
      day.grooming = dailyGrooming;
      day.daycare = dailyDaycare;
      // Handle 53rd ISO Week https://en.wikipedia.org/wiki/ISO_week_date
      const weekNo = day.date.isoWeek() === 53 ? 52 : day.date.isoWeek();
      const week = getAttr(year.weeks, weekNo, { days: [] });
      week.days.push(day);
    }
  }

  // Calc weekly targets
  for (const year of Object.values(years)) { // eslint-disable-line
    for (const [week, data] of Object.entries(year.weeks)) { // eslint-disable-line
      data.days_open = data.days.length;
      data.total = toCurrency(data.days.reduce((acc, d) => acc + d.total, 0), 0);
      data.grooming = toCurrency(data.days.reduce((acc, d) => acc + d.grooming, 0), 0);
      data.retail = toCurrency(data.days.reduce((acc, d) => acc + d.retail, 0), 0);
      data.daycare = toCurrency(data.days.reduce((acc, d) => acc + d.daycare, 0), 0);
    }
  }

  // Update Mongo via GraphQL
  // First should we update or add?
  for (const [year, data] of Object.entries(years)) { // eslint-disable-line
    const query = await queryGraphQL(targetYearQuery, { year: Number(year), store: store.name }); // eslint-disable-line
    const { target } = query;
    const targetId = target ? target._id : null; // eslint-disable-line
    const mutation = targetMutation(store, year, data, targetId);
    await mutateGraphQL(mutation); // eslint-disable-line
    console.log(`Update ${store.name} ${year} targets`);
  }
}

async function process() {
  // Loop through the stores
  await Promise.all(Object.entries(workbook.Sheets).map(async ([storeName, sheet]) => {
    const store = await getStore(storeName);
    const targets = getTargets(sheet);
    return processStore(store, targets);
  }));
}

process().then(() => console.log('done'));
