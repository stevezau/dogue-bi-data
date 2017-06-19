'use strict'
import gql from 'graphql-tag'
import deepEqual from 'deep-equal'
import chrono from 'chrono-node'
import _ from 'lodash'
import Moment from 'moment-timezone'
import momentQtr from 'moment-fquarter'
import { extendMoment } from 'moment-range'
import {
  getGraphCli,
  storeQuery,
  TimedMutation,
  createGroupedArray,
  divide,
  toCurrency
} from '../utils'

const moment = extendMoment(Moment)

const depsAllowed = [
  'Daycare',
  'Grooming',
  'Retail'
]

const departmentMutation = (departments) => {
  let formatted = []
  for (let department of departments) {
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
    }`)
  }
  return formatted
}

const createReportMutation = (report, docId) => {
  const update = docId ? `id: "${docId}"` : ''
  const action = docId ? 'update' : 'add'
  const departments = departmentMutation(report.departments).join(' ')
  const localDate = report.local_date.replace(/-/g, '')
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
      }`
}

const reportTouchMutation = (day, docId) => {
  const localDate = day.local_date.replace(/-/g, '')
  return `c${localDate}: updateReport(
    id: "${docId}"
    report: {
        local_date: "${day.local_date}"
    }), {
        _id
      }`
}

const salesAttrs = `
  target
  sales_total
  sales_subtotal
  sales_tax
  sales_discount
  transactions
  units
  average_unit_value`

const wageAttrs = `
  hours
  wages
  average_hourly_productivity
  staff
  wage_cost_percent`

const dailyQuery = gql`
  query report($store: String!, $from: Date!, $to: Date!, $fys: [Int]!, $group: String!, $type: String!) {
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
    calcSales(store: $store, from: $from, to: $to, group: $group) {
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
    targets (store:$store, fys: $fys) {
      fy
      weekly {
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
      monthly{
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
      quarterly{
        q1 {total, retail, daycare, grooming}
        q2 {total, retail, daycare, grooming}
        q3 {total, retail, daycare, grooming}
        q4 {total, retail, daycare, grooming}
      }
      year {total, retail, daycare, grooming}
    }
  }`

const deleteOld = gql`
    mutation deleteReport($store: String!, $from: Date!, $to: Date!, $updatedBefore:Date!, $type: String!) {
      delete: deleteReport(store:$store, from: $from, to: $to, updatedBefore: $updatedBefore, type: $type) {
        _id
      }
    }`

function sortType (data, sales, wages, targets) {
  const reports = {}
  for (let date of moment.range(data.from, data.to).by(data.type.group)) {
    const localDate = data.type.format(date.format('YYYY-MM-DD'))
    reports[localDate] = {
      date: date,
      type: data.type,
      local_date: localDate,
      sales: [],
      wages: [],
      target: {total: 0, retail: 0, grooming: 0, daycare: 0}
    }
  }

  for (let sale of sales) {
    const date = data.type.format(sale.date)
    reports[date].sales.push(sale)
  }

  for (let wage of wages) {
    const date = data.type.format(wage.date)
    reports[date].wages.push(wage)
  }

  for (let report of Object.values(reports)) {
    const target = data.type.target(report.date, targets)
    if (target) {
      report.target = target
    }
  }
  return reports
}

const typesAllowed = {
  'day': {
    type: 'day',
    startOf: (d) => d.startOf('day'),
    endOf: (d) => d.endOf('day'),
    group: 'day',
    format: (d) => moment(d).format('YYYY-MM-DD'),
    target: (date, targets) => {}
  },
  'month': {
    type: 'month',
    startOf: (d) => d.startOf('month'),
    endOf: (d) => d.endOf('month'),
    group: 'month',
    format: (d) => moment(d).format('YYYY-MM'),
    target: (date, targets) => {
      const fy = targets[typesAllowed['year'].format(date)] || {monthly: {}}
      return fy.monthly[moment(date).format('MMM').toLowerCase()]
    }
  },
  'quarter': {
    type: 'quarter',
    startOf: (d) => d.startOf('quarter'),
    endOf: (d) => d.endOf('quarter'),
    group: 'month',
    format: (d) => {
      return String(momentQtr(d).fquarter(7).quarter)
    },
    target: (date, targets) => {
      const fy = targets[typesAllowed['year'].format(date)] || {quarterly: {}}
      const qtr = momentQtr(date).fquarter(7).quarter
      return fy.quarterly[`q${qtr}`]
    }
  },
  'year': {
    type: 'year',
    startOf: (d) => {
      const year = momentQtr(d).fquarter(7).year
      return moment.tz(`${year}-07-01`, d._z.name)
    },
    endOf: (d) => {
      const year = momentQtr(d).fquarter(7).nextYear
      return moment.tz(`${year}-06-30`, d._z.name)
    },
    group: 'month',
    format: (d) => {
      return String(momentQtr(d).fquarter(7).year)
    },
    target: (date, targets) => {
      const fy = targets[momentQtr(date).fquarter(7).year] || {}
      return fy.year
    }
  }
}

function formatReport (report, data) {
  return new Promise((resolve, reject) => {
    let newReport = {
      store: data.store.name,
      type: data.type.type,
      date: report.date.toISOString(),
      local_date: report.local_date,
      // Sales
      target: report.target.total,
      sales_total: 0.0,
      sales_subtotal: 0.0,
      sales_tax: 0.0,
      sales_discount: 0.0,
      transactions: 0.0,
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
    }

    function newDep (name) {
      newReport.departments[name] = {
        name: name,
        target: report.target[name.toLowerCase()],
        sales_total: 0.0,
        sales_subtotal: 0.0,
        sales_tax: 0.0,
        sales_discount: 0.0,
        transactions: 0.0,
        units: 0,
        average_unit_value: 0.0,
        // Wages
        hours: 0.0,
        wages: 0.0,
        average_hourly_productivity: 0.0,
        staff: [],
        wage_cost_percent: 0.0
      }
    }

    for (let deptSale of report.sales) {
      if (!depsAllowed.includes(deptSale.department)) continue
      newReport.sales_total += deptSale.total
      newReport.sales_subtotal += deptSale.subtotal
      newReport.sales_tax += deptSale.tax
      newReport.sales_discount += deptSale.discount
      newReport.transactions += deptSale.transactions.length
      newReport.units += deptSale.units

      if (!(deptSale.department in newReport.departments)) newDep(deptSale.department)
      let dept = newReport.departments[deptSale.department]
      dept.sales_total += deptSale.total
      dept.sales_subtotal += deptSale.subtotal
      dept.sales_tax += deptSale.tax
      dept.sales_discount += deptSale.discount
      dept.units += deptSale.units
    }

    for (let deptWage of report.wages) {
      if (!depsAllowed.includes(deptWage.department)) continue
      newReport.hours += deptWage.hours
      newReport.wages += deptWage.total
      for (let employee of deptWage.employees) {
        if (!(employee in newReport.staff)) {
          newReport.staff.push(employee)
        }
      }

      if (!(deptWage.department in newReport.departments)) newDep(deptWage.department)
      let dept = newReport.departments[deptWage.department]
      dept.hours = deptWage.hours
      dept.wages = deptWage.total
      for (let employee of deptWage.employees) {
        if (!(employee in dept.staff)) {
          dept.staff.push(employee)
        }
      }
    }

    newReport.staff = newReport.staff.length
    newReport.average_unit_value = divide(newReport.sales_total, newReport.units)
    newReport.units_per_transaction = divide(newReport.units, newReport.transactions)
    newReport.avg_transaction_value = divide(newReport.sales_total, newReport.transactions)
    newReport.wage_cost_percent = divide(newReport.wages, newReport.sales_total) * 100
    newReport.average_hourly_productivity = divide(newReport.sales_total, newReport.hours)
    newReport.sales_total = toCurrency(newReport.sales_total)
    newReport.sales_subtotal = toCurrency(newReport.sales_subtotal)
    newReport.sales_tax = toCurrency(newReport.sales_tax)
    newReport.sales_discount = toCurrency(newReport.sales_discount)
    newReport.transactions = toCurrency(newReport.transactions)
    newReport.hours = toCurrency(newReport.hours)
    newReport.wages = toCurrency(newReport.wages)
    newReport.average_hourly_productivity = toCurrency(newReport.average_hourly_productivity)
    newReport.wage_cost_percent = toCurrency(newReport.wage_cost_percent)

    newReport.departments = Object.values(newReport.departments).reduce((d, dept) => {
      dept.staff = dept.staff.length
      dept.average_unit_value = divide(dept.sales_total, dept.units)
      dept.wage_cost_percent = divide(dept.wages, dept.sales_total) * 100
      dept.average_hourly_productivity = divide(dept.sales_total, dept.hours)
      dept.sales_total = toCurrency(dept.sales_total)
      dept.sales_subtotal = toCurrency(dept.sales_subtotal)
      dept.sales_tax = toCurrency(dept.sales_tax)
      dept.sales_discount = toCurrency(dept.sales_discount)
      dept.transactions = toCurrency(dept.transactions)
      dept.hours = toCurrency(dept.hours)
      dept.wages = toCurrency(dept.wages)
      dept.average_hourly_productivity = toCurrency(dept.average_hourly_productivity)
      dept.wage_cost_percent = toCurrency(dept.wage_cost_percent)
      d.push(dept)
      return d
    }, [])
    resolve(newReport)
  })
}

function reportMutation (report, existingReport, data) {
  return new Promise((resolve, reject) => {
    formatReport(report, data).then(report => {
      if (existingReport) {
        // Clone object so we can make changes
        let existing = _.cloneDeep(existingReport)
        existing.departments = []
        let docId = existing._id

        Object.keys(existing).forEach(k => {
          if (k.startsWith('_')) delete existing[k]
        })
        for (let d of existingReport.departments) {
          let department = {...d}
          Object.keys(department).forEach(k => {
            if (k.startsWith('_')) delete department[k]
          })
          existing.departments.push(department)
        }

        if (!deepEqual(report, existing)) {
          // report has changed, build mutation
          resolve(createReportMutation(report, docId))
        } else {
          // report has not changed but needs to be touched/updated
          resolve(reportTouchMutation(report, docId))
        }
      } else {
        // Add new report
        resolve(createReportMutation(report))
      }
    })
  })
}

function process (data) {
  return new Promise((resolve, reject) => {
    const graphCli = getGraphCli()
    let promises = []

    for (let report of Object.values(data.sorted)) {
      promises.push(reportMutation(report, data.existingReports[report.local_date], data))
    }
    return Promise.all(promises)
      .then(mutations => {
        // Run mutations in chunks of 30
        let requests = []
        mutations = mutations.reduce((mutations, m) => {
          if (m !== '') {
            mutations.push(m)
          }
          return mutations
        }, [])
        for (let chunk of createGroupedArray(mutations, 30)) {
          const mutation = gql`
              mutation {
                ${chunk}
              }`
          requests.push(TimedMutation(graphCli.mutate({mutation: mutation}), `${chunk.length} Report`))
        }
        return Promise.all(requests)
      })
      .then(() => resolve())
      .catch((err) => reject(err))
  })
}

function getFYs (from, to) {
  let fiscalYears = []

  for (let month of moment.range(from, to).by('month')) {
    const qtr = momentQtr(month).fquarter(7)
    if (!fiscalYears.includes(qtr.year)) {
      fiscalYears.push(qtr.year)
    }
  }
  return fiscalYears
}

export default (event, context, callback) => {
  if (!event.store) return callback(new Error('Missing store parameter'))
  const type = typesAllowed[event.type]
  if (!type) return callback(new Error('Missing or invalid type parameter'))
  const api = getGraphCli()
  const from = chrono.parseDate(event.from)
  const to = chrono.parseDate(event.to)
  if (!from) return callback(new Error('Missing or invalid from parameter'))
  if (!to) return callback(new Error('Missing or invalid to parameter'))

  const now = moment.utc().toISOString()
  let data

  const query = gql`
    query Store($store: String!) {
      ${storeQuery}
    }`

  api.query({query: query, variables: {store: event.store}})
    .then(rsp => {
      data = {
        type: type,
        store: rsp.data.store,
        from: type.startOf(moment.tz(from, rsp.data.store.timezone)),
        to: type.endOf(moment.tz(to, rsp.data.store.timezone))
      }
      return api.query({
        query: dailyQuery,
        variables: {
          from: data.from.toISOString(),
          to: data.to.toISOString(),
          store: event.store,
          fys: getFYs(data.from, data.to),
          group: data.type.group,
          type: event.type
        }
      })
    })
    .then(rsp => {
      const targets = rsp.data.targets.reduce((targets, target) => {
        targets[target.fy] = target
        return targets
      }, {})

      data.sorted = sortType(data, rsp.data.calcSales, rsp.data.calcWages, targets)
      data.existingReports = rsp.data.reports.reduce((existing, report) => {
        existing[report.local_date] = report
        return existing
      }, {})
      return process(data)
    })
    .then(() => {
      console.log('Deleting daily that were not updated')
      return api.mutate({
        mutation: deleteOld,
        variables: {
          from: data.from.toISOString(),
          to: data.to.toISOString(),
          updatedBefore: now,
          store: event.store,
          type: event.type
        }
      })
    })
    .then(() => callback(null, 'event: updated daily'))
    .catch(err => callback(err))
}
