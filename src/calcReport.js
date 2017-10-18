import chrono from 'chrono-node';
import Moment from 'moment-timezone';
import { extendMoment } from 'moment-range';
import { reportMutation, dailyQuery, deleteReports } from './graph.schema';
import {
  getStore,
  handleError,
  queryGraphQL,
  mutateGraphQL,
  divide,
  toCurrency,
  compareArrays,
  chunkMutations
} from './utils';

const moment = extendMoment(Moment);

const depsAllowed = [
  'Daycare',
  'Grooming',
  'Retail'
];

function sortType(store, type, allSales, deptSales, wages, targets) {
  const now = moment();
  const reports = {};

  function getReport(date) {
    const localDate = type.format(date);
    if (!(localDate in reports)) {
      reports[localDate] = {
        date: type.formatDT(date, store.timezone),
        type,
        local_date: localDate,
        allSales: [],
        deptSales: [],
        wages: [],
        target: {
          total: 0, retail: 0, grooming: 0, daycare: 0
        }
      };
    }
    return reports[localDate];
  }

  deptSales.forEach((sale) => {
    const report = getReport(sale.date);
    report.deptSales.push(sale);
  });

  allSales.forEach((sale) => {
    const report = getReport(sale.date);
    report.allSales.push(sale);
  });

  wages.forEach((wage) => {
    const report = getReport(wage.date);
    report.wages.push(wage);
  });

  Object.entries(reports).forEach(([date, report]) => {
    if (report.date > now || (report.allSales.length === 0 && report.wages.length === 0)) {
      delete reports[date];
      return;
    }

    const target = type.target(report.date, targets);
    if (target) {
      report.target = target; //eslint-disable-line
    }
  });

  return reports;
}

const typesAllowed = {
  day: {
    type: 'day',
    startOf: d => moment(d).startOf('day'),
    endOf: d => moment(d).endOf('day'),
    group: { query: 'day', date: 'day' },
    format: d => moment(d).format('YYYY-MM-DD'),
    formatDT: (d, tz) => moment.tz(d, tz).hour(7), // User hour 7 to remove daylight savings issues
    target: () => {}
  },
  week: {
    type: 'week',
    startOf: d => moment(d).startOf('week'),
    endOf: d => moment(d).endOf('week'),
    group: { query: 'day', date: 'week' },
    format: d => moment(d).format('YYYY-w'),
    formatDT: (d, tz) => moment.tz(d, tz).startOf('isoWeek').hour(7), // User hour 7 to remove daylight savings issues
    target: (date, targets) => {
      const year = targets[moment(date).format('YYYY')] || { weeks: {} };
      const week = moment(date).format('w');
      return year.weeks[`w${week}`];
    }
  },
  month: {
    type: 'month',
    startOf: d => moment(d).startOf('month'),
    endOf: d => moment(d).endOf('month'),
    group: { query: 'month', date: 'month' },
    format: d => moment(d).format('YYYY-MM'),
    formatDT: (d, tz) => moment.tz(d, tz).startOf('month').hour(7), // User hour 7 to remove daylight savings issues
    target: (date, targets) => {
      const year = targets[moment(date).format('YYYY')] || { months: {} };
      return year.months[moment(date).format('MMM').toLowerCase()];
    }
  }
};

function formatReport(store, type, report) {
  const newReport = {
    store: store.name,
    key: `${report.local_date}-${type.type}`,
    type: type.type,
    date: report.date.toISOString(),
    local_date: report.local_date,
    // Sales
    target: report.target.total,
    sales_total: 0.0,
    sales_subtotal: 0.0,
    sales_tax: 0.0,
    sales_discount: 0.0,
    transactions: 0,
    units: 0,
    average_unit_value: 0.0,
    // Wages
    hours: 0.0,
    wages: 0.0,
    average_hourly_productivity: 0.0,
    staff: [],
    wage_cost_percent: 0.0,
    // Others
    units_per_transaction: 0.0,
    avg_transaction_value: 0.0,
    departments: {}
  };

  let isFuture = false;
  if (report.date.diff(moment(), 'days') === 0) {
    if (moment.tz(moment(), store.timezone).hours() < 16) isFuture = true;
  } else if (report.date > moment.tz(moment(), store.timezone)) isFuture = true;

  function newDep(name) {
    newReport.departments[name] = {
      name,
      target: report.target[name.toLowerCase()],
      sales_total: 0.0,
      sales_subtotal: 0.0,
      sales_tax: 0.0,
      sales_discount: 0.0,
      transactions: 0,
      units: 0,
      average_unit_value: 0.0,
      // Wages
      hours: 0.0,
      wages: 0.0,
      average_hourly_productivity: 0.0,
      staff: [],
      wage_cost_percent: 0.0
    };
  }

  report.allSales.forEach((sale) => {
    newReport.sales_total += sale.total;
    newReport.sales_subtotal += sale.subtotal;
    newReport.sales_tax += sale.tax;
    newReport.sales_discount += sale.discount;
    newReport.transactions += sale.transactions;
    newReport.units += sale.units;
  });

  report.deptSales.forEach((deptSale) => {
    if (!depsAllowed.includes(deptSale.department)) return;
    if (!(deptSale.department in newReport.departments)) newDep(deptSale.department);
    const dept = newReport.departments[deptSale.department];
    dept.sales_total += deptSale.total;
    dept.sales_subtotal += deptSale.subtotal;
    dept.sales_tax += deptSale.tax;
    dept.sales_discount += deptSale.discount;
    dept.units += deptSale.units;
  });

  report.wages.forEach((deptWage) => {
    if (!depsAllowed.includes(deptWage.department)) return;
    newReport.hours += deptWage.hours;
    newReport.wages += deptWage.total;
    deptWage.employees.forEach((employee) => {
      if (!(employee in newReport.staff)) {
        newReport.staff.push(employee);
      }
    });

    if (!(deptWage.department in newReport.departments)) newDep(deptWage.department);
    const dept = newReport.departments[deptWage.department];
    dept.hours = deptWage.hours;
    dept.wages = deptWage.total;
    deptWage.employees.forEach((employee) => {
      if (!(employee in dept.staff)) {
        dept.staff.push(employee);
      }
    });
  });

  newReport.staff = newReport.staff.length;
  if (!isFuture) {
    newReport.wage_cost_percent = toCurrency(divide(newReport.wages, newReport.sales_total) * 100); // eslint-disable-line
    newReport.average_hourly_productivity = divide(newReport.sales_total, newReport.hours);
  }

  newReport.average_unit_value = divide(newReport.sales_subtotal, newReport.units);
  newReport.units_per_transaction = divide(newReport.units, newReport.transactions);
  newReport.avg_transaction_value = divide(newReport.sales_subtotal, newReport.transactions);
  newReport.sales_total = toCurrency(newReport.sales_total);
  newReport.sales_subtotal = toCurrency(newReport.sales_subtotal);
  newReport.sales_tax = toCurrency(newReport.sales_tax);
  newReport.sales_discount = toCurrency(newReport.sales_discount);
  newReport.transactions = toCurrency(newReport.transactions);
  newReport.hours = toCurrency(newReport.hours);
  newReport.wages = toCurrency(newReport.wages);

  newReport.departments = Object.values(newReport.departments).reduce((accum, d) => {
    const dept = { ...d };
    if (!isFuture) {
      dept.wage_cost_percent = toCurrency(divide(dept.wages, dept.sales_subtotal) * 100);
      dept.average_hourly_productivity = divide(dept.sales_subtotal, dept.hours);
    }
    dept.average_unit_value = divide(dept.sales_subtotal, dept.units);
    dept.staff = dept.staff.length;
    dept.sales_total = toCurrency(dept.sales_total);
    dept.sales_subtotal = toCurrency(dept.sales_subtotal);
    dept.sales_tax = toCurrency(dept.sales_tax);
    dept.sales_discount = toCurrency(dept.sales_discount);
    dept.transactions = toCurrency(dept.transactions);
    dept.hours = toCurrency(dept.hours);
    dept.wages = toCurrency(dept.wages);
    accum.push(dept);
    return accum;
  }, []);
  return newReport;
}

function getData(store, type, from, to) {
  const years = [];
  for (const year of moment.range(from, to).by(type.group.date)) { // eslint-disable-line
    if (!years.includes(year.year())) {
      years.push(year.year());
    }
  }

  return queryGraphQL(dailyQuery, {
    years,
    from: from.toISOString(),
    to: to.toISOString(),
    store: store.name,
    group: type.group.query,
    type: type.type
  });
}

function processUpdates(store, updated, deleted) {
  const promises = [];
  const mutations = updated.map(wage => reportMutation(wage));
  if (mutations.length > 0) {
    console.log(`Will update ${mutations.length} reports`);
    promises.push(mutateGraphQL(chunkMutations(mutations)));
  }
  if (deleted.length > 0) {
    console.log(`Will delete ${deleted.length} reports`);
    promises.push(mutateGraphQL(deleteReports, { store: store.name, ids: deleted.map(w => w._id) })); // eslint-disable-line
  }
  return Promise.all(promises);
}

export async function calcReport(event, context, callback) {
  if (!event.store) return callback(new Error('Missing store parameter'));

  const type = typesAllowed[event.type];
  if (!type) return callback(new Error('Missing or invalid type parameter'));

  const from = chrono.parseDate(event.from);
  const to = chrono.parseDate(event.to);
  if (!from) return callback(new Error('Missing or invalid from parameter'));
  if (!to) return callback(new Error('Missing or invalid to parameter'));

  try {
    const store = await getStore(event.store);
    const fromTZ = type.startOf(moment.tz(from, store.timezone));
    const toTZ = type.endOf(moment.tz(to, store.timezone));

    console.log(`CalcReport ${event.type} for ${event.store} from: ${fromTZ.format()} to: ${toTZ.format()}`);

    const data = await getData(store, type, fromTZ, toTZ);

    const targets = data.targets.reduce((accum, t) => {
      accum[t.year] = t; // eslint-disable-line
      return accum;
    }, {});

    const existingReports = data.reports.map(r => ({ ...r, key: `${r.local_date}-${r.type}` }));

    const sorted = sortType(store, type, data.allSales, data.deptSales, data.calcWages, targets);
    const formatted = Object.values(sorted).map(r => formatReport(store, type, r));

    const compared = compareArrays(existingReports, formatted, 'key');
    processUpdates(store, compared.updated, compared.deleted);

    callback(null, 'updated reports');
  } catch (err) {
    handleError(err, event.store, callback);
  }
}
