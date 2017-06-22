'use strict'
import fetch from 'node-fetch'
import moment from 'moment-timezone'
import consoleTS from 'console-stamp'
import calcReport from './functions/calcReport'
import schedule from './functions/schedule'

process.env.TZ = 'UTC'
moment.tz.setDefault('UTC')
global.fetch = fetch
consoleTS(console, 'HH:MM:ss.l')

exports.calcReport = calcReport
exports.schedule = schedule
