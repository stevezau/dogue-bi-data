import chrono from 'chrono-node';
import Moment from 'moment-timezone';
import { extendMoment } from 'moment-range';
import cloneDeep from 'clone-deep';
import { reportMutation, dailyQuery, deleteReports, prevQuery, defaultMetrics } from './graph.schema';
import {
  getStore,
  handleError,
  queryGraphQL,
  mutateGraphQL,
  divide,
  toCurrency,
  compareArrays,
  chunkMutations,
  openDays
} from './utils';

const moment = extendMoment(Moment);

function KPIMetrics(store, metrics, report) {
  const isFuture = report.type.isFuture(store, report);

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
    sales_target: target || 0,
    sales_total: toCurrency(sales.reduce((v, s) => v + s.total, 0) || defaultMetrics.sales_total),
    sales_subtotal: toCurrency(sales.reduce((v, s) => v + s.subtotal, 0) || defaultMetrics.sales_subtotal),
    sales_tax: toCurrency(sales.reduce((v, s) => v + s.tax, 0) || defaultMetrics.sales_tax),
    sales_discount: toCurrency(sales.reduce((v, s) => v + s.discount, 0) || defaultMetrics.sales_discount),
    sales_transactions: toCurrency(sales.reduce((v, s) => v + s.transactions, 0) || defaultMetrics.sales_transactions),
    sales_units: sales.reduce((v, s) => v + s.units, 0) || defaultMetrics.sales_units
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

function sortDataByType(store, type, data) {
  const sorted = {};

  function getSortDate(date) {
    const localDate = type.format(date);
    if (!(localDate in sorted)) {
      sorted[localDate] = {
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
    return sorted[localDate];
  }

  function getDept(date, name) {
    const report = getSortDate(date);
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
    const report = getSortDate(sale.date);
    report.sales.push(sale);
  });

  data.wages.forEach((wage) => {
    const dept = getDept(wage.date, wage.department.toLowerCase());
    dept.wages.push(wage);
  });

  return sorted;
}

function sortType(store, type, data, targets) {
  const now = moment();

  const sorted = sortDataByType(store, type, data);

  Object.entries(sorted).forEach(([date, report]) => {
    if (report.date > now || (report.sales === {} && report.wages.length === 0)) {
      delete sorted[date];
      return;
    }

    const target = type.target(report.date, targets);
    if (target) {
      report.target = target; //eslint-disable-line
    }
  });
  return sorted;
}

async function appendPrevData(store, type, reports) {
  return Promise.all(reports.map((async (report) => {
    const newReport = cloneDeep(report);

    const appendData = (prefix, data) => {
      Object.values(newReport.departments).forEach((dept) => {
        // Set defaults
        let renamed = Object.entries(defaultMetrics).reduce((a, v) => ({ ...a, [`${prefix}_${v[0]}`]: v[1] }), {});

        const found = data.departments.filter(d => d.name === dept.name)[0];
        if (found) {
          renamed = {
            ...renamed,
            ...Object.entries(found.metrics).reduce((a, v) => ({ ...a, [`${prefix}_${v[0]}`]: v[1] }), {})
          };
        }
        Object.assign(dept.metrics, renamed);
      });
    };

    const prevPeriodLocalDate = type.format(type.prevPeriod(newReport.date));
    const prevYearLocalDate = type.format(type.prevYear(newReport.date));

    let prevPeriodReport = reports.filter(r => (
      r.local_date === prevPeriodLocalDate && r.type === type.type && r.store === store.name))[0];
    let prevYearReport = reports.filter(r => (
      r.local_date === prevYearLocalDate && r.type === type.type && r.store === store.name))[0];

    if (!prevPeriodReport) {
      const existing = await queryGraphQL(prevQuery, {
        store: store.name,
        local_date: prevPeriodLocalDate,
        type: type.type
      });
      prevPeriodReport = existing.report || { departments: [] };
    }

    if (!prevYearReport) {
      const existing = await queryGraphQL(prevQuery, {
        store: store.name,
        local_date: prevYearLocalDate,
        type: type.type
      });
      prevYearReport = existing.report || { departments: [] };
    }

    appendData('prev_period', prevPeriodReport);
    appendData('prev_year', prevYearReport);

    return newReport;
  })));
}

const typesAllowed = {
  day: {
    type: 'day',
    startOf: d => moment(d).startOf('day'),
    endOf: d => moment(d).endOf('day'),
    prevYear: d => moment(d).subtract(1, 'years'),
    prevPeriod: d => moment(d).subtract(1, 'days'),
    group: { query: 'day', date: 'day' },
    format: d => moment(d).format('YYYY-MM-DD'),
    formatDT: (d, tz) => moment.tz(d, tz).hour(7), // User hour 7 to remove daylight savings issues
    target: () => {},
    isFuture: (store, report) => {
      // Don't include future or current day if before 5pm
      const diffDays = report.date.diff(moment(), 'days');
      if (diffDays > 0) return true;
      if (diffDays === 0) {
        const todayClosing = moment.tz(moment(), store.timezone).hour('17').minute(0);
        if (todayClosing > moment.tz(moment(), store.timezone)) return true;
      }
      return false;
    }
  },
  week: {
    type: 'week',
    startOf: d => moment(d).startOf('isoWeek'),
    endOf: d => moment(d).endOf('isoWeek'),
    prevYear: d => moment(d).subtract(1, 'years'),
    prevPeriod: d => moment(d).subtract(1, 'weeks'),
    group: { query: 'day', date: 'week' },
    format: d => moment(d).format('YYYY-W'),
    formatDT: (d, tz) => moment.tz(d, tz).startOf('isoWeek').hour(7), // User hour 7 to remove daylight savings issues
    target: (date, targets) => {
      const year = targets[moment(date).format('YYYY')] || { weeks: {} };
      const week = moment(date).format('W');
      return year.weeks[`w${week}`];
    },
    isFuture: () => false
  },
  month: {
    type: 'month',
    startOf: d => moment(d).startOf('month'),
    endOf: d => moment(d).endOf('month'),
    prevYear: d => moment(d).subtract(1, 'years'),
    prevPeriod: d => moment(d).subtract(1, 'months'),
    group: { query: 'month', date: 'month' },
    format: d => moment(d).format('YYYY-MM'),
    formatDT: (d, tz) => moment.tz(d, tz).startOf('month').hour(7), // User hour 7 to remove daylight savings issues
    target: (date, targets) => {
      const year = targets[moment(date).format('YYYY')] || { months: {} };
      return year.months[moment(date).format('MMM').toLowerCase()];
    },
    isFuture: () => false
  }
};

function formatReport(store, type, report) {
  const departments = {
    daycare: { name: 'daycare', metrics: {} },
    grooming: { name: 'grooming', metrics: {} },
    retail: { name: 'retail', metrics: {} },
  };

  const reportFrom = type.startOf(report.date);
  const reportTo = type.endOf(report.date);

  let daysOpen = {};
  let daysLeft = [];

  if (store.days_open) {
    daysOpen = openDays(store, reportFrom, reportTo);
    const today = moment.tz();
    daysLeft = Object.values(daysOpen).filter(d => d.date.diff(today, 'days') >= 0);
  }

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
    days_open: Object.values(daysOpen).length,
    days_left: daysLeft.length
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

async function processStore(name, from, to, type) {
  try {
    let store;

    if (name === 'network') {
      store = { name: 'network', timezone: 'Australia/Sydney' };
    } else {
      store = await getStore(name);
    }

    const fromTZ = type.startOf(moment.tz(from, store.timezone));
    let toTZ = type.endOf(moment.tz(to, store.timezone));

    const now = moment.tz(moment(), store.timezone).endOf('day');
    if (toTZ > now) {
      toTZ = now;
    }

    console.log(`CalcReport ${type.type} for ${name} from: ${fromTZ.format()} to: ${toTZ.format()}`);

    const data = await getData(store, type, fromTZ, toTZ);

    const targets = data.targets.reduce((accum, t) => {
      accum[t.year] = t; // eslint-disable-line
      return accum;
    }, {});

    const existingReports = data.reports.map(r => ({ ...r, key: `${r.local_date}-${r.type}` }));

    const sorted = sortType(store, type, data, targets);
    const formatted = Object.values(sorted).map(r => formatReport(store, type, r));
    const withPrev = await appendPrevData(store, type, formatted);

    const compared = compareArrays(existingReports, withPrev, 'key');
    await processUpdates(store, compared.updated, compared.deleted);

    console.log(`${store.name} updated reports`);
  } catch (err) {
    handleError(err, name);
  }
}

export async function calcReport(event, context, callback) {
  const from = chrono.parseDate(event.from);
  const to = chrono.parseDate(event.to);
  if (!from) return callback(new Error('Missing or invalid from parameter'));
  if (!to) return callback(new Error('Missing or invalid to parameter'));

  const type = typesAllowed[event.type];
  if (!type) return callback(new Error('Missing or invalid type parameter'));

  const stores = event.stores ? event.stores : [event.store];

  try {
    await Promise.all(stores.map(name => processStore(name, from, to, type)));
    callback(null, 'updated reports');
  } catch (err) {
    handleError(err, stores, callback);
  }
}
