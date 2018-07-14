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

function departmentMutation(departments) {
  return departments.map((department) => { // eslint-disable-line
    const { metrics } = department;
    return `{
      name: "${department.name}"
      metrics: {
        sales_target: ${metrics.sales_target}
        sales_total: ${metrics.sales_total}
        sales_subtotal: ${metrics.sales_subtotal}
        sales_tax: ${metrics.sales_tax}
        sales_discount: ${metrics.sales_discount}
        sales_transactions: ${metrics.sales_transactions}
        sales_units: ${metrics.sales_units}
  
        units_per_transaction: ${metrics.units_per_transaction}
        avg_transaction_value: ${metrics.avg_transaction_value}
        average_unit_value: ${metrics.average_unit_value}
        average_hourly_productivity: ${metrics.average_hourly_productivity}
        wage_cost_percent: ${metrics.wage_cost_percent}
  
        staff_count: ${metrics.staff_count}
        staff_hours: ${metrics.staff_hours}
        staff_wages: ${metrics.staff_wages}
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
        departments: [
          ${departmentMutation(report.departments).join(' ')}
        ]
      }), {
        _id
      }`;
}

export const dailyQuery = `
  query report($store: String!, $from: Date!, $to: Date!, $years: [Int]!, $group: String!, $type: String!) {
    reports(store: $store, from: $from, to: $to, type: $type) {
      _id
      store
      type
      date
      local_date
      departments {
        name
        metrics {
          sales_target
          sales_total
          sales_subtotal
          sales_tax
          sales_discount
          sales_transactions
          sales_units
          units_per_transaction
          avg_transaction_value
          average_unit_value
          average_hourly_productivity
          wage_cost_percent
          staff_hours
          staff_wages
          staff_count
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