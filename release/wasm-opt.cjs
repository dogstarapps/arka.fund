const fs=require('node:fs'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const file=path.resolve(process.argv[2]);
if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!=='0284fdf9172127deaecccfc8d8ce1eba55ce06e3ea3d373a2ead8fda35f2b445')throw Error('BINARYEN_123_IDENTITY_REQUIRED');
process.argv=[process.execPath,file,...process.argv.slice(3)];const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(fs.readFileSync(file,'utf8'),file+'.cjs');
