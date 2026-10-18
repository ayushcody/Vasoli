import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const supabase=process.env.SUPABASE_URL;
if(supabase!=='http://127.0.0.1:55421')throw new Error('API checks require the isolated local Supabase stack.');
const api='http://127.0.0.1:8080';const service=process.env.SUPABASE_SERVICE_ROLE_KEY;const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=new pg.Client({connectionString:process.env.PILOT_ADMIN_DATABASE_URL});await admin.connect();
const users=[];let checks=0;
function pass(name){checks++;console.log(`PASS ${name}`);}
async function auth(path,body,key=service,method='POST'){
 const r=await fetch(`${supabase}/auth/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok){const failure=await r.json();throw new Error(`Local auth ${path.split('?')[0]} failed (${r.status}): ${failure.error_code??failure.code??'unknown'} ${failure.msg??failure.error_description??''}`);}return r.status===204?{}:r.json();
}
async function makeUser(){const password=crypto.randomBytes(20).toString('hex');const email=`pilot-check-${crypto.randomUUID()}@vasoli.local`;const user=await auth('admin/users',{email,password,email_confirm:true});users.push(user.id);const session=await auth('token?grant_type=password',{email,password},anon);return {id:user.id,token:session.access_token};}
async function rpc(user,serviceName,method,body={},expected=200){
 const response=await fetch(`${api}/rpc/vasoli.v1.${serviceName}/${method}`,{method:'POST',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json','Connect-Protocol-Version':'1'},body:JSON.stringify(body)});
 const result=await response.json();if(expected!==200){assert.notEqual(response.status,200,`${method} unexpectedly accepted another user's reference`);return result;}
 if(!response.ok)throw new Error(`${serviceName}.${method}: ${response.status} ${result.code??'unknown'} ${result.message??''}`);return result;
}
async function csv(user,filters={}){
 const payload=Buffer.from(JSON.stringify(filters));const body=Buffer.alloc(payload.length+5);body.writeUInt32BE(payload.length,1);payload.copy(body,5);
 const response=await fetch(`${api}/rpc/vasoli.v1.PilotService/ExportTransactions`,{method:'POST',headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/connect+json','Connect-Protocol-Version':'1'},body});
 if(!response.ok)throw new Error(`Streaming export failed (${response.status})`);
 const bytes=Buffer.from(await response.arrayBuffer());let offset=0,text='';
 while(offset<bytes.length){const flags=bytes[offset];const length=bytes.readUInt32BE(offset+1);const message=JSON.parse(bytes.subarray(offset+5,offset+5+length).toString());if(flags&2){if(message.error)throw new Error(`Streaming export: ${message.error.code}`);}else text+=Buffer.from(message.csvChunk??'','base64').toString();offset+=5+length;}
 return text;
}
const indiaDate=(offset=0)=>{const key=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());const date=new Date(`${key}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
try{
 const a=await makeUser(),b=await makeUser();
 await rpc(a,'UserService','GetProfile');await rpc(b,'UserService','GetProfile');
 const account=(await rpc(a,'AccountService','CreateAccount',{accountType:'SAVINGS',institutionName:'Local fixture',accountName:'Salary account',balancePaise:'1000000',currency:'INR'})).account;
 const other=(await rpc(b,'AccountService','CreateAccount',{accountType:'SAVINGS',institutionName:'Local fixture',accountName:'Other user',balancePaise:'1000000',currency:'INR'})).account;
 assert.equal((await rpc(b,'AccountService','ListAccounts')).accounts?.some(x=>x.id===account.id)??false,false);
 await rpc(a,'PilotService','ConfirmAccountBalance',{accountId:other.id,balancePaise:'1000000'},404);
 await rpc(a,'TransactionService','CreateTransaction',{accountId:other.id,amountPaise:'100',description:'wrong-owner',date:`${indiaDate()}T00:00:00Z`,type:'EXPENSE'},404);
 const rest=await fetch(`${supabase}/rest/v1/financial_accounts?id=eq.${other.id}`,{headers:{apikey:anon,Authorization:`Bearer ${a.token}`}});assert.equal(rest.status,200);assert.deepEqual(await rest.json(),[]);
 pass('real auth, account ownership and direct REST isolation');
 await rpc(a,'PilotService','ConfirmAccountBalance',{accountId:account.id,balancePaise:'1000000'});
 const config={nextPayday:indiaDate(7),dailyAllowancePaise:'10000',minimumReservePaise:'100000',goalReservedPaise:'0',payingAccountIds:[account.id]};
 const plan=(await rpc(a,'PilotService','UpdatePaydayPlan',{config})).plan;
 assert.equal(plan.actionable,true);assert.equal(plan.dayProjections.length,7,'Forecast must exclude payday itself');
 assert.equal(plan.dayProjections.at(-1).date,indiaDate(6));
 assert.equal(plan.dayProjections[0].safeToSpendPaise,'830000','Today must protect spending allowance through the entire horizon');
 await rpc(a,'PilotService','ConfirmAccountBalance',{accountId:account.id,balancePaise:'1000000',confirmedAt:new Date(Date.now()-8*86400000).toISOString()});
 assert.equal((await rpc(a,'PilotService','GetPaydayPlan')).actionable??false,false);
 await rpc(a,'PilotService','ConfirmAccountBalance',{accountId:account.id,balancePaise:'1000000'});
 pass('exclusive payday horizon, future commitments and stale-balance blocking');
 const text=`date,description,amount\n${indiaDate()},Import fixture,-100.29\n${indiaDate()},Import fixture,-100.29\nnot-a-date,Rejected fixture,-10\n`;
 const preview=await rpc(a,'ImportService','PreviewStatement',{accountId:account.id,fileName:'fixture.csv',file:Buffer.from(text).toString('base64'),format:'generic',openingBalancePaise:'1000000',closingBalancePaise:'979942'});
 assert.equal(preview.rows.length,2);assert.equal(preview.rejected.length,1,'Every invalid row must be explained');assert.equal(preview.reconciliation.matches,true);
 const commit={previewToken:preview.previewToken,idempotencyKey:crypto.randomUUID(),skipRowNumbers:preview.rejected.map(x=>x.rowNumber)};
 const imported=await rpc(a,'ImportService','CommitStatementImport',commit);console.log({preview,imported});assert.equal(imported.createdCount,2,'Genuine repeated transactions must be preserved');
 const repeated=await rpc(a,'ImportService','CommitStatementImport',commit);assert.equal(repeated.batchId,imported.batchId);
 const unchanged=(await rpc(a,'AccountService','ListAccounts')).accounts.find(x=>x.id===account.id);assert.equal(unchanged.balancePaise,'1000000','Import must not double-adjust current account snapshots');
 pass('authoritative preview, row explanations, exact reconciliation, atomic idempotent import');
 const destination=(await rpc(a,'AccountService','CreateAccount',{accountType:'CASH',institutionName:'Local',accountName:'Wallet',balancePaise:'10000',currency:'INR'})).account;
 const transfer=await rpc(a,'PilotService','CreateTransfer',{fromAccountId:account.id,toAccountId:destination.id,amountPaise:'20000',date:new Date().toISOString(),description:'Own-account transfer',idempotencyKey:crypto.randomUUID()});
 const debit=(await rpc(a,'TransactionService','GetTransaction',{id:transfer.debitTransactionId})).transaction;const credit=(await rpc(a,'TransactionService','GetTransaction',{id:transfer.creditTransactionId})).transaction;
 assert.equal(debit.type,'TRANSFER');assert.equal(credit.type,'TRANSFER');assert.equal(debit.transferDirection,'OUT');assert.equal(credit.transferDirection,'IN');
 const expense=(await rpc(a,'TransactionService','CreateTransaction',{accountId:account.id,amountPaise:'10000',description:'Refund original',date:new Date().toISOString(),type:'EXPENSE'})).transaction;
 await rpc(a,'TransactionService','CreateTransaction',{accountId:account.id,amountPaise:'5000',description:'Partial refund',date:new Date().toISOString(),type:'REFUND',refundOfTransactionId:expense.id});
 await rpc(a,'TransactionService','CreateTransaction',{accountId:account.id,amountPaise:'6000',description:'Over-refund',date:new Date().toISOString(),type:'REFUND',refundOfTransactionId:expense.id},400);
 pass('atomic paired transfers and linked partial-refund limits');
 await admin.query(`INSERT INTO transactions(user_id,account_id,amount_paise,description,merchant_raw,merchant_norm,date,type) SELECT $1,$2,1,'Export fixture '||n,'fixture','fixture',NOW(),'EXPENSE' FROM generate_series(1,235) n`,[a.id,account.id]);
 await rpc(a,'TransactionService','CreateTransaction',{accountId:account.id,amountPaise:'1',description:'=HYPERLINK("test")',date:new Date().toISOString(),type:'EXPENSE'});
 let cursor='',found=0;do{const page=await rpc(a,'TransactionService','ListTransactions',{pageSize:50,accountId:account.id,search:'Export fixture',...(cursor?{pageToken:cursor}:{})});found+=page.transactions?.length??0;cursor=page.nextPageToken??'';}while(cursor);assert.equal(found,235);
 const exported=await csv(a,{accountId:account.id});assert.ok(exported.split('\n').length>235);assert.ok(exported.includes("'=HYPERLINK"),'User text must be escaped for spreadsheet formula injection');
 const foreign=await csv(b,{search:'Export fixture'});assert.equal(foreign.trim().split('\n').length,1);
 const denied=await fetch(`${api}/rpc/vasoli.v1.PilotService/ExportTransactions`,{method:'POST',headers:{'Content-Type':'application/connect+json'},body:Buffer.alloc(5)});assert.equal(denied.status,401);
 pass('complete filtered cursor/export beyond 200 rows, formula escaping and streaming auth');
 const exportedUser=await fetch(`${api}/lifecycle/export`,{method:'POST',headers:{Authorization:`Bearer ${a.token}`}});assert.equal(exportedUser.status,200);const data=await exportedUser.json();assert.ok(JSON.stringify(data).includes('Export fixture'));
 const deleted=await fetch(`${api}/lifecycle/delete`,{method:'POST',headers:{Authorization:`Bearer ${a.token}`,'Content-Type':'application/json'},body:JSON.stringify({idempotencyKey:crypto.randomUUID(),confirm:'DELETE'})});
 assert.ok([200,202].includes(deleted.status),`Deletion failed (${deleted.status})`);const deletion=await deleted.json();assert.equal(deletion.status,'COMPLETED');assert.equal(Number((await admin.query('SELECT count(*) FROM transactions WHERE user_id=$1',[a.id])).rows[0].count),0);assert.equal(Number((await admin.query('SELECT count(*) FROM auth.users WHERE id=$1',[a.id])).rows[0].count),0);
 pass('current-user export and complete local data/auth deletion');
 console.log(`${checks} authenticated pilot API scenario groups passed.`);
}finally{
 for(const id of users){try{await auth(`admin/users/${id}`,undefined,service,'DELETE');}catch{/* already deleted or cleanup reported separately */}}
 await admin.end();
}
