import Moment from 'moment';
import { extendMoment } from 'moment-range';
import Holidays from 'date-holidays';
import XLSX from 'xlsx';
import { toCurrency, queryGraphQL, mutateGraphQL, chunkMutations } from './src/utils';

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
  return XLSX.utils.sheet_to_json(sheet).map((row) => {
    return {
      month: moment(row.month, 'YYYY-MMM'),
      total: Number(row.total.replace(dollarRegex, '')) || 0,
      retail: Number(row.retail.replace(dollarRegex, '')) || 0,
      grooming: Number(row.grooming.replace(dollarRegex, '')) || 0,
      daycare: Number(row.daycare.replace(dollarRegex, '')) || 0
    };
  });
}

function getAttr(obj, key, defValue) {
  if (!obj.hasOwnProperty(key)) {
    obj[key] = defValue;
  }
  return obj[key];
}

function openDays(month, holidays) {
  // Figure out the open days per month
  const days = {};
  const range = moment.range(moment(month).startOf('month'), moment(month).endOf('month'));

  for (let day of range.by('day')) {
    // Check if Sunday, Closed
    if (day.isoWeekday() === 7) continue;

    // Check if  {Holiday, Closed
    if (holidays.isHoliday(day.toDate())) continue;

    days[day.format('YYYY-MM-DD')] = { date: day };
  }

  return days;
}

function targetMutation(store, year, data, targetId) {
  const update = targetId ? `id: "${targetId}"` : '';
  const action = targetId ? 'update' : 'add';

  const weeks = Object.entries(data.weeks).map(([week, data]) => {
    return `w${week}: {total: ${data.total}, retail: ${data.retail}, daycare: ${data.daycare}, grooming: ${data.grooming}}\n`;
  });

  const months = Object.entries(data.months).map(([month, data]) => {
    const monthName = data.date.format('MMM').toLowerCase();
    return `${monthName}: {total: ${data.total}, retail: ${data.retail}, daycare: ${data.daycare}, grooming: ${data.grooming}}\n`;
  });

  return `
    mutation {
      ${action}Target(
        ${update}
        target: {
          store: "${store}",
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

// Loop through the stores
for (const [storeName, sheet] of Object.entries(workbook.Sheets)) {
  // TODO: Use store location
  const holidays = new Holidays('AU', 'NSW');
  const targets = getTargets(sheet);

  // Sort targets, oldest month first
  targets.sort((a, b) => a.month - b.month);

  const years = {};

  // Figure out the targets by year, month incl holidays
  for (const target of targets) {
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
    month.days = openDays(target.month, holidays);

    // Figure out the daily targets
    const openCount = Object.keys(month.days).length;
    const dailyTotal = month.total / openCount;
    const dailyRetail = month.retail / openCount;
    const dailyGrooming = month.grooming / openCount;
    const dailyDaycare = month.daycare / openCount;

    // Update days with targets and add to week
    for (const day of Object.values(month.days)) {
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
  for (const year of Object.values(years)) {
    for (const [week, data] of Object.entries(year.weeks)) {
      data.total = toCurrency(data.days.reduce((acc, d) => acc + d.total, 0), 0);
      data.grooming = toCurrency(data.days.reduce((acc, d) => acc + d.grooming, 0), 0);
      data.retail = toCurrency(data.days.reduce((acc, d) => acc + d.retail, 0), 0);
      data.daycare = toCurrency(data.days.reduce((acc, d) => acc + d.daycare, 0), 0);
    }
  }

  // Update Mongo via GraphQL
  // First should we update or add?
  for (const [year, data] of Object.entries(years)) {
    queryGraphQL(targetYearQuery, { year: Number(year), store: storeName })
      .then(({ target }) => {
        const targetId = target ? target._id : null;
        const mutation = targetMutation(storeName, year, data, targetId);
        return mutateGraphQL(mutation);
      })
      .then(() => {
        console.log(`Update ${storeName} ${year} targets`)
      })
      .catch(err => {
        console.log(err);
      });

  }

}
