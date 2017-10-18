export const storeQuery = `
    query Store($store: String!) {
      store(name: $store) {
      name
      timezone
      deputy {
        url
        api_key
      }
    }
  }`;

export function departmentMutation(departments) {
  const formatted = [];
  departments.forEach((department) => {
    formatted.push(`{
      name: "${department.name}"
      target: ${department.target}
      sales_total: ${department.sales_total}
      sales_subtotal: ${department.sales_subtotal}
      sales_tax: ${department.sales_tax}
      sales_discount: ${department.sales_discount}
      transactions: ${department.transactions}
      units: ${department.units}
      average_unit_value: ${department.average_unit_value}
      hours: ${department.hours}
      wages: ${department.wages}
      average_hourly_productivity: ${department.average_hourly_productivity}
      staff: ${department.staff}
      wage_cost_percent: ${department.wage_cost_percent}
    }`);
  });
  return formatted;
}

export function reportMutation(report) {
  const docId = report._id; // eslint-disable-line
  const update = docId ? `id: "${docId}"` : '';
  const action = docId ? 'update' : 'add';
  const departments = departmentMutation(report.departments).join(' ');
  const localDate = report.local_date.replace(/-/g, '');
  return `a${localDate}: ${action}Report(
      ${update}
      report: {
        store: "${report.store}",
        type: "${report.type}",
        date: "${report.date}",
        local_date: "${report.local_date}",

        target: ${report.target}
        sales_total: ${report.sales_total}
        sales_subtotal: ${report.sales_subtotal}
        sales_tax: ${report.sales_tax}
        sales_discount: ${report.sales_discount}
        transactions: ${report.transactions}
        units: ${report.units}
        average_unit_value: ${report.average_unit_value}

        hours: ${report.hours}
        wages: ${report.wages}
        average_hourly_productivity: ${report.average_hourly_productivity}
        staff: ${report.staff}
        wage_cost_percent: ${report.wage_cost_percent}

        units_per_transaction: ${report.units_per_transaction}
        avg_transaction_value: ${report.avg_transaction_value}
        departments: [
          ${departments}
        ]
      }), {
        _id
      }`;
}

export function reportTouchMutation(day, docId) {
  const localDate = day.local_date.replace(/-/g, '');
  return `c${localDate}: updateReport(
    id: "${docId}"
    report: {
        local_date: "${day.local_date}"
    }), {
        _id
      }`;
}

const salesAttrs = `
  target
  sales_total
  sales_subtotal
  sales_tax
  sales_discount
  transactions
  units
  average_unit_value`;

const wageAttrs = `
  hours
  wages
  average_hourly_productivity
  staff
  wage_cost_percent`;

export const dailyQuery = `
  query report($store: String!, $from: Date!, $to: Date!, $years: [Int]!, $group: String!, $type: String!) {
    reports(store: $store, from: $from, to: $to, type: $type) {
      _id
      store
      type
      date
      local_date
      ${salesAttrs}
      ${wageAttrs}
      units_per_transaction
      avg_transaction_value
      departments {
        name
        ${salesAttrs}
        ${wageAttrs}
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
    allSales: calcSales(store: $store, from: $from, to: $to, group: $group, department: false) {
      date
      department
      total
      tax
      units
      subtotal
      discount
      transactions
    }
    calcWages(store: $store, from: $from, to: $to, group: $group) {
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
    mutation deleteReport($store: String!, $from: Date!, $to: Date!, $updatedBefore:Date!, $type: String!) {
      delete: deleteReport(store:$store, from: $from, to: $to, updatedBefore: $updatedBefore, type: $type) {
        _id
      }
    }`;
