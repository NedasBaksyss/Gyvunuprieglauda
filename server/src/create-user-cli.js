import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { config } from './config.js';
import { openDatabase } from './database/index.js';
import { createUser } from './auth.js';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, stdin: { type: 'boolean' }, help: { type: 'boolean' } } });
if (values.help) {
  console.log('npm run user:create -- --email admin@prieglauda.lt --name Administratorius --role admin');
  console.log('Slaptažodis įvedamas paslėptai. Automatizavimui --stdin priima JSON per standartinę įvestį.');
} else {
  let database;
  let terminal;
  try {
    let input;
    if (values.stdin) input = JSON.parse(readFileSync(0, 'utf8'));
    else {
      if (!process.stdin.isTTY) throw new Error('Paleiskite komandą interaktyviame terminale arba naudokite --stdin.');
      let hidden = false;
      const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk, encoding); callback(); } });
      terminal = createInterface({ input: process.stdin, output, terminal: true });
      const email = values.email || await terminal.question('El. paštas: ');
      const name = values.name || await terminal.question('Vardas: ');
      const role = values.role || (await terminal.question('Rolė (admin / employee, numatyta admin): ')) || 'admin';
      const first = terminal.question('Slaptažodis (12–128 simbolių): '); hidden = true;
      const password = await first; hidden = false; process.stdout.write('\n');
      const second = terminal.question('Pakartokite slaptažodį: '); hidden = true;
      const confirmation = await second; hidden = false; process.stdout.write('\n');
      if (password !== confirmation) throw new Error('Slaptažodžiai nesutampa.');
      input = { email, name, role, password };
    }
    database = openDatabase(config.databasePath);
    const user = await createUser(database, input);
    console.log(`Sukurta paskyra: ${user.email} (${user.role}).`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { terminal?.close(); database?.close(); }
}
