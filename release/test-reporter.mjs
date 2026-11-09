import fs from'node:fs';
export default class{
 onInit(ctx){this.ctx=ctx;}
 onTestRunEnd(modules,errors,reason){const result={reason,unhandledErrors:errors,lateUnhandledErrors:this.ctx.state.getUnhandledErrors(),files:modules.map(m=>({id:m.moduleId,state:m.state()}))};fs.writeFileSync(process.env.ARKA_TEST_DIAGNOSTIC_FILE,JSON.stringify(result,null,2)+'\n',{flag:'wx'});process.stderr.write(JSON.stringify({reason,unhandledErrors:errors.length})+'\n');}
}
