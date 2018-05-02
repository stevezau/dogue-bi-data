import consoleTS from 'console-stamp';
import 'source-map-support/register';

import { calcReport } from './src/calcReport';

consoleTS(console, 'HH:MM:ss.l');

exports.calcReport = calcReport;
