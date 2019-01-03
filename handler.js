import consoleTS from 'console-stamp';
import 'source-map-support/register';

consoleTS(console, 'HH:MM:ss.l');

export { calcReport } from './src/calcReport';
