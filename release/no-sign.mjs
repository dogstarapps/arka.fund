import {stellarTestModules} from './stellar-test-modules.mjs';
import fs from 'node:fs';import path from 'node:path';import {threadId} from 'node:worker_threads';
let attempts=0;
const deny=()=>{attempts++;const directory=process.env.ARKA_CRYPTO_EVIDENCE_DIR;if(directory){fs.mkdirSync(directory,{recursive:true});fs.appendFileSync(path.join(directory,'crypto-events-'+process.pid+'-'+threadId+'.jsonl'),JSON.stringify({type:'denied',profile:'signing-disabled'})+'\n',{mode:0o600});}throw Error('ISOLATED_TEST_CRYPTOGRAPHIC_SIGNING_DENIED');};
const install=sdk=>{for(const name of['Keypair','Transaction','FeeBumpTransaction'])if(sdk[name]?.prototype?.sign)sdk[name].prototype.sign=deny;};
for(const {sdk} of await stellarTestModules())install(sdk);
process[Symbol.for('arkafund.test.signaturePolicy')]=install;
process.once('exit',()=>{if(attempts){process.exitCode=1;process.stderr.write(JSON.stringify({containment:'NO_SIGNING',attemptsDenied:attempts})+'\n');}});
