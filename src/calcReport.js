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

function KPIMetrics(store, metrics, report) {
  let isFuture = false;
  if (report.date.diff(moment(), 'days') === 0) {
    if (moment.tz(moment(), store.timezone).hours() < 16) isFuture = true;
  } else if (report.date > moment.tz(moment(), store.timezone)) isFuture = true;

  const kpiMetrics = {
    units_per_transaction: divide(metrics.sales_units, metrics.sales_transactions),
    average_unit_value: divide(metrics.sales_subtotal, metrics.sales_units),
    avg_transaction_value: divide(metrics.sales_subtotal, metrics.sales_transactions),
    wage_cost_percent: 0,
    average_hourly_productivity: 0
  };

  if (!isFuture) {
    kpiMetrics.wage_cost_percent = divide(metrics.staff_wages, metrics.sales_subtotal) * 100;
    kpiMetrics.average_hourly_productivity = divide(metrics.sales_subtotal, metrics.staff_hours);
  }

  return kpiMetrics;
}

function salesMetrics(sales, target) {
  return {
    sales_target: target,
    sales_total: toCurrency(sales.reduce((v, s) => v + s.total, 0) || 0.0),
    sales_subtotal: toCurrency(sales.reduce((v, s) => v + s.subtotal, 0) || 0.0),
    sales_tax: toCurrency(sales.reduce((v, s) => v + s.tax, 0) || 0.0),
    sales_discount: toCurrency(sales.reduce((v, s) => v + s.discount, 0) || 0.0),
    sales_transactions: toCurrency(sales.reduce((v, s) => v + s.transactions, 0) || 0),
    sales_units: sales.reduce((v, s) => v + s.units, 0) || 0
  };
}

function wageMetrics(departments) {
  let hours = 0;
  let wages = 0.0;

  const staff = new Set();
  departments.forEach((d) => {
    hours += toCurrency(d.wages.reduce((v, w) => w.hours + v, 0)) || 0;
    wages += toCurrency(d.wages.reduce((v, w) => w.total + v, 0)) || 0;
    d.wages.forEach((wage) => {
      const employees = wage.employees || [];
      employees.forEach(emp => staff.add(emp));
    });
  });

  return {
    staff_hours: hours,
    staff_wages: wages,
    staff_count: staff.size
  };
}

function sortType(store, type, data, targets) {
  const now = moment();
  const reports = {};

  function getReport(date) {
    const localDate = type.format(date);
    if (!(localDate in reports)) {
      reports[localDate] = {
        date: type.formatDT(date, store.timezone),
        type,
        target: {
          store: 0, retail: 0, grooming: 0, daycare: 0
        },
        sales: [],
        local_date: localDate,
        departments: {}
      };
    }
    return reports[localDate];
  }

  function getDept(date, name) {
    const report = getReport(date);
    if (!(name in report.departments)) {
      report.departments[name] = { sales: [], wages: [] };
    }
    return report.departments[name];
  }

  data.deptSales.forEach((sale) => {
    const dept = getDept(sale.date, sale.department.toLowerCase());
    dept.sales.push(sale);
  });

  data.sales.forEach((sale) => {
    const report = getReport(sale.date);
    report.sales.push(sale);
  });

  data.wages.forEach((wage) => {
    const dept = getDept(wage.date, wage.department.toLowerCase());
    dept.wages.push(wage);
  });

  Object.entries(reports).forEach(([date, report]) => {
    if (report.date > now || (report.sales === {} && report.wages.length === 0)) {
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
  const departments = {
    daycare: { name: 'daycare', metrics: {} },
    grooming: { name: 'grooming', metrics: {} },
    retail: { name: 'retail', metrics: {} },
  };

  const storeMetrics = {};

  // Sales Metrics
  Object.assign(storeMetrics, salesMetrics(report.sales, report.target.total || 0));

  // Wage Metrics
  const validDepts = [];
  Object.entries(report.departments).forEach(([deptName, deptObj]) => {
    if (deptName in departments) validDepts.push(deptObj);
  });
  Object.assign(storeMetrics, wageMetrics(validDepts));

  // KPI Metrics
  Object.assign(storeMetrics, KPIMetrics(store, storeMetrics, report));

  // Department Metrics
  Object.entries(departments).forEach(([deptName, deptObj]) => {
    const dept = report.departments[deptName] || { sales: [], wages: [] };
    // Dept Sales
    Object.assign(deptObj.metrics, salesMetrics(dept.sales || {}, report.target[deptName] || 0)); // eslint-disable-line

    // Dept Wages
    Object.assign(deptObj.metrics, wageMetrics([dept]));

    // Dept KPI Metrics
    Object.assign(deptObj.metrics, KPIMetrics(store, deptObj.metrics, report));
  });

  departments.store = { name: 'store', metrics: storeMetrics };

  return {
    store: store.name,
    key: `${report.local_date}-${type.type}`,
    type: type.type,
    date: report.date.toISOString(),
    local_date: report.local_date,
    departments: Object.values(departments),
  };
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
  const mutations = updated.map(r => reportMutation(r));
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
    let toTZ = type.endOf(moment.tz(to, store.timezone));

    // Don't include future or current day if before 5pm
    const now = moment.tz(moment(), store.timezone);
    const nowDayEnd = moment.tz(moment(), store.timezone).hour('17').minute(0);
    const yesterday = moment.tz(moment(), store.timezone).subtract(1, 'day').endOf('day');
    if (toTZ > now) {
      // toTZ is in the future
      if (now < nowDayEnd) {
        // Before 5pm on current day, use yesterday
        toTZ = yesterday;
      } else {
        toTZ = now;
      }
    }

    console.log(`CalcReport ${event.type} for ${event.store} from: ${fromTZ.format()} to: ${toTZ.format()}`);

    const data = await getData(store, type, fromTZ, toTZ);

    const targets = data.targets.reduce((accum, t) => {
      accum[t.year] = t; // eslint-disable-line
      return accum;
    }, {});

    const existingReports = data.reports.map(r => ({ ...r, key: `${r.local_date}-${r.type}` }));

    const sorted = sortType(store, type, data, targets);
    const formatted = Object.values(sorted).map(r => formatReport(store, type, r));

    const compared = compareArrays(existingReports, formatted, 'key');
    processUpdates(store, compared.updated, compared.deleted);

    callback(null, 'updated reports');
  } catch (err) {
    handleError(err, event.store, callback);
  }
}
