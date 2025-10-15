import 'dotenv/config';
import { execSync } from 'child_process';

const port = process.env.PORT;
console.log(`Starting Next.js on port ${port}...`);

//use this to run on dev
execSync(`npx next dev --turbopack -p ${port}`, { stdio: 'inherit' });

//the uncommet below are for production build and run
// Uncomment the following line if you need to build the project before starting
// execSync(`npx next build`, { stdio: 'inherit' });
//use this to run on prod
// execSync(`npx next start -p ${port}`, { stdio: 'inherit' });