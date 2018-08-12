export const storeQuery = `
    query Store($store: String!) {
      store(name: $store) {
      name
      days_open
      state
      timezone
      deputy {
        url
        api_key
      }
    }
  }`;

export const defaultMetrics = {
  sales_target: 0.0,
  sales_total: 0.0,
  sales_subtotal: 0.0,
  sales_tax: 0.0,
  sales_discount: 0.0,
  sales_transactions: 0,
  sales_units: 0,

  units_per_transaction: 0.0,
  avg_transaction_value: 0.0,
  average_unit_value: 0.0,
  average_hourly_productivity: 0.0,
  wage_cost_percent: 0.0,

  staff_count: 0,
  staff_hours: 0.0,
  staff_wages: 0.0,
  bookings: 0
};

function metricsMutation(metrics, key) {
  const prefix = key ? `${key}_` : '';

  return Object.entries(defaultMetrics).map(([mKey, mValue]) => {
    const value = metrics[`${prefix}${mKey}`] || mValue;
    return `${prefix}${mKey}: ${value}`;
  }).join('\n');
}

function departmentMutation(departments) {
  return departments.map((department) => { // eslint-disable-line
    const { metrics } = department;
    return `{
      name: "${department.name}"
      metrics: {
        ${metricsMutation(metrics)}
        ${metricsMutation(metrics, 'prev_period')}
        ${metricsMutation(metrics, 'prev_year')}
       }
    }`;
  });
}

export function reportMutation(report) {
  const docId = report._id; // eslint-disable-line
  const update = docId ? `id: "${docId}"` : '';
  const action = docId ? 'update' : 'add';
  const localDate = report.local_date.replace(/-/g, '');
  return `a${localDate}: ${action}Report(
      ${update}
      report: {
        store: "${report.store}",
        type: "${report.type}",
        date: "${report.date}",
        local_date: "${report.local_date}",
        days_open: ${report.days_open},
        days_left: ${report.days_left},
        prev_period_days_open: ${report.prev_period_days_open || 0},
        prev_period_days_left: ${report.prev_period_days_left || 0},
        prev_year_days_open: ${report.prev_year_days_open || 0},
        prev_year_days_left: ${report.prev_year_days_left || 0},
        departments: [
          ${departmentMutation(report.departments).join(' ')}
        ]
      }), {
        _id
      }`;
}

const metrics = [
  'sales_target',
  'sales_total',
  'sales_subtotal',
  'sales_tax',
  'sales_discount',
  'sales_transactions',
  'sales_units',
  'units_per_transaction',
  'avg_transaction_value',
  'average_unit_value',
  'average_hourly_productivity',
  'wage_cost_percent',
  'staff_hours',
  'staff_wages',
  'staff_count',
  'bookings'
];


export const prevQuery = `
  query report($store: String!, $local_date: String!, $type: String!) {
    report(store: $store, local_date: $local_date, type: $type) {
      _id
      store
      type
      date
      local_date
      days_open
      days_left
      prev_period_days_open
      prev_period_days_left
      prev_year_days_open
      prev_year_days_left      
      departments {
        name
        metrics {
          ${metrics.join('\n')}
        }
      }
    }
  }`;

export const dailyQuery = `
  query report($store: String!, $from: Date!, $to: Date!, $years: [Int]!, $group: String!, $type: String!) {
    reports(store: $store, from: $from, to: $to, type: $type) {
      _id
      store
      type
      date
      local_date
      days_open
      days_left
      prev_period_days_open
      prev_period_days_left
      prev_year_days_open
      prev_year_days_left      
      departments {
        name
        metrics {
          ${metrics.join('\n')}
          ${metrics.map(m => `prev_period_${m}`).join('\n')}
          ${metrics.map(m => `prev_year_${m}`).join('\n')}
        }
      }
    }
    deptSales: calcSales(store: $store, from: $from, to: $to, group: $group, department: true) {
      date
      department
      total
      tax
      units
      subtotal
      discount
      transactions
    }
    sales: calcSales(store: $store, from: $from, to: $to, group: $group, department: false) {
      date
      department
      total
      tax
      units
      subtotal
      discount
      transactions
    }
    wages: calcWages(store: $store, from: $from, to: $to, group: $group) {
      date
      department
      total
      super
      employees
      hours
    }
    bookings: calcBookings(store: $store, from: $from, to: $to, group: $group) {
      date
      department
      bookings
    }
    targets (store:$store, years: $years) {
      year
      weeks {
        w1 {total, retail, daycare, grooming}
        w2 {total, retail, daycare, grooming}
        w3 {total, retail, daycare, grooming}
        w4 {total, retail, daycare, grooming}
        w5 {total, retail, daycare, grooming}
        w6 {total, retail, daycare, grooming}
        w7 {total, retail, daycare, grooming}
        w8 {total, retail, daycare, grooming}
        w9 {total, retail, daycare, grooming}
        w10 {total, retail, daycare, grooming}
        w11 {total, retail, daycare, grooming}
        w12 {total, retail, daycare, grooming}
        w13 {total, retail, daycare, grooming}
        w14 {total, retail, daycare, grooming}
        w15 {total, retail, daycare, grooming}
        w16 {total, retail, daycare, grooming}
        w17 {total, retail, daycare, grooming}
        w18 {total, retail, daycare, grooming}
        w19 {total, retail, daycare, grooming}
        w20 {total, retail, daycare, grooming}
        w21 {total, retail, daycare, grooming}
        w22 {total, retail, daycare, grooming}
        w23 {total, retail, daycare, grooming}
        w24 {total, retail, daycare, grooming}
        w25 {total, retail, daycare, grooming}
        w26 {total, retail, daycare, grooming}
        w27 {total, retail, daycare, grooming}
        w28 {total, retail, daycare, grooming}
        w29 {total, retail, daycare, grooming}
        w30 {total, retail, daycare, grooming}
        w31 {total, retail, daycare, grooming}
        w32 {total, retail, daycare, grooming}
        w33 {total, retail, daycare, grooming}
        w34 {total, retail, daycare, grooming}
        w35 {total, retail, daycare, grooming}
        w36 {total, retail, daycare, grooming}
        w37 {total, retail, daycare, grooming}
        w38 {total, retail, daycare, grooming}
        w39 {total, retail, daycare, grooming}
        w40 {total, retail, daycare, grooming}
        w41 {total, retail, daycare, grooming}
        w42 {total, retail, daycare, grooming}
        w43 {total, retail, daycare, grooming}
        w44 {total, retail, daycare, grooming}
        w45 {total, retail, daycare, grooming}
        w46 {total, retail, daycare, grooming}
        w47 {total, retail, daycare, grooming}
        w48 {total, retail, daycare, grooming}
        w49 {total, retail, daycare, grooming}
        w50 {total, retail, daycare, grooming}
        w51 {total, retail, daycare, grooming}
        w52 {total, retail, daycare, grooming}
      }
      months{
        jan {total, retail, daycare, grooming}
        feb {total, retail, daycare, grooming}
        mar {total, retail, daycare, grooming}
        apr {total, retail, daycare, grooming}
        may {total, retail, daycare, grooming}
        jun {total, retail, daycare, grooming}
        jul {total, retail, daycare, grooming}
        aug {total, retail, daycare, grooming}
        sep {total, retail, daycare, grooming}
        oct {total, retail, daycare, grooming}
        nov {total, retail, daycare, grooming}
        dec {total, retail, daycare, grooming}
      }
    }
  }`;

export const deleteReports = `
    mutation deleteReport($store: String!, $ids: [String]!) {
      delete: deleteReport(store:$store, ids: $ids) {
        _id
      }
    }`;
