import { spawn } from 'node:child_process';
if(!process.env.DATABASE_URL?.includes('127.0.0.1:55422')) throw new Error('Start with node --env-file=.env.pilot.local scripts/pilot/dev.mjs.');
const children=[spawn('go',['run','./cmd/server'],{cwd:'backend',detached:true,stdio:'inherit',env:process.env}),...(process.env.PILOT_BACKEND_ONLY === 'true' ? [] : [spawn('npm',['run',process.env.PILOT_PRODUCTION === 'true' ? 'start' : 'dev','--','--hostname','127.0.0.1','--port',process.env.PILOT_WEB_PORT || '3001'],{detached:true,stdio:'inherit',env:process.env})])];
let stopping=false;
function stop(code){if(stopping)return;stopping=true;for(const p of children){try{process.kill(-p.pid,'SIGTERM');}catch{}}process.exitCode=code;}
for(const p of children){p.on('exit',c=>stop(c??1));p.on('error',()=>stop(1));}
process.on('SIGINT',()=>stop(0));process.on('SIGTERM',()=>stop(0));
