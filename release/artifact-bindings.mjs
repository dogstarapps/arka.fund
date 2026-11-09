import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
/** Bind operational constructor metadata to the selected release, not an older profile. */
export function verifyArtifactBindings(root,selection,{profile,matrix}={}){
 profile??=JSON.parse(fs.readFileSync(root+'/release/factory-constructor-profile.json'));
 matrix??=JSON.parse(fs.readFileSync(root+'/release/initialization-matrix.json'));
 const selected=new Map(selection.contracts.map(row=>[row.role,row]));
 const check=(row,role)=>{assert(row&&row.role===role,'BINDING_ROLE_CHANGED '+role);const actual=selected.get(role);assert(actual&&['file','sha256','bytes'].every(key=>row[key]===actual[key]),'BINDING_WASM_CHANGED '+role);};
 check(profile.factory,'arka-factory');check(profile.fund,'arka');
 for(const [pin,role]of Object.entries({guard:'oracle-guard',registry:'venue-registry',route:'adapter-aquarius',share:'share-token'}))check(profile.pins[pin],role);
 for(const [field,file]of Object.entries({factorySource:'contracts/arka-factory/src/lib.rs',factoryManagedRoutesSource:'contracts/arka-factory/src/managed_routes_creation.rs'})){assert.equal(profile[field].file,file,'BINDING_SOURCE_PATH_CHANGED');assert.equal(profile[field].sha256,digest(root+'/'+file),'BINDING_SOURCE_CHANGED '+file);}
 const rows=matrix.matrix.filter(row=>row.production);assert.deepEqual(rows.map(row=>row.package).sort(),selection.contracts.filter(row=>row.role!=='xlm-normalizer').map(row=>row.role).sort(),'INITIALIZATION_SCOPE_CHANGED');
 // The vault template is initialized atomically by its factory; auxiliary modules use constructors.
 for(const row of rows){assert.equal(row.constructor,row.package!=='arka','INITIALIZATION_MODE_CHANGED '+row.package);check(row.wasm,row.package);}
 return{constructorProfileVerified:true,initializationPackages:rows.length,selectedWasm:selection.contracts.length};
}
