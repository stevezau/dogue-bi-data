import XLSX from 'xlsx';
import phone from 'phone';
import { queryGraphQL, mutateGraphQL, compareArrays, chunkMutations } from '../src/utils';

const clientMobileQuery = `
    query clients($mobiles: [String]) {
      clients(mobiles: $mobiles) {
        _id
        mobile
        global_sms_opt_out
      }
    }`;

const clientEmailQuery = `
    query clients($emails: [String]) {
      clients(emails: $emails) {
        _id
        email
        global_email_opt_out
      }
    }`;

function clientMutation(client, field) {
  const docId = client._id; // eslint-disable-line
  const update = docId ? `id: "${docId}"` : '';
  const action = docId ? 'update' : 'add';
  return `c${docId}: ${action}Client(
      ${update}
      client: {
        ${field}: ${client[field]}
      }), {
        uid
      }`;
}

async function run() {
  // Loop through the stores
  const workbook = XLSX.readFile(process.argv[2]);
  const sheet = Object.values(workbook.Sheets)[0];
  const json = XLSX.utils.sheet_to_json(sheet);
  const mobiles = json.map(m => phone(m.Mobile, 'AUS')[0]).filter(m => m);
  const emails = json.map(e => e['Email address - other'] || e['Email address - work']).filter(e => e);

  if (mobiles.length > 0) {
    const { clients } = await queryGraphQL(clientMobileQuery, { mobiles });
    const formatted = clients.map(client => ({
      ...client,
      global_sms_opt_out: true
    }));
    const { updated } = compareArrays(clients, formatted, '_id', false);
    const promises = [];
    const mutations = updated.map(c => clientMutation(c, 'global_sms_opt_out'));
    if (mutations.length > 0) {
      console.log(`Will update ${mutations.length} clients`);
      promises.push(mutateGraphQL(chunkMutations(mutations, 50)));
    }
    return Promise.all(promises);
  }

  if (emails.length > 0) {
    const { clients } = await queryGraphQL(clientEmailQuery, { emails });
    const formatted = clients.map(client => ({
      ...client,
      global_email_opt_out: true
    }));
    const { updated } = compareArrays(clients, formatted, '_id', false);
    const promises = [];
    const mutations = updated.map(c => clientMutation(c, 'global_email_opt_out'));
    if (mutations.length > 0) {
      console.log(`Will update ${mutations.length} clients`);
      promises.push(mutateGraphQL(chunkMutations(mutations, 50)));
    }
    return Promise.all(promises);
  }
}

run().then(() => console.log('done'));
