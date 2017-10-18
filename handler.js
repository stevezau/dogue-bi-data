import consoleTS from 'console-stamp';
import { calcReport } from './src/calcReport';

consoleTS(console, 'HH:MM:ss.l');

exports.calcReport = calcReport;
