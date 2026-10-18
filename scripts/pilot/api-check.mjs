import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const supabase=process.env.SUPABASE_URL;
const recovery=process.env.PILOT_RECOVERY_CHECK==='true';
const expectedSupabase=recovery?'http://127.0.0.1:55521':'http://127.0.0.1:55421';
if(supabase!==expectedSupabase)throw new Error('API checks require the isolated local Supabase stack.');
const databaseURL=new URL(process.env.PILOT_ADMIN_DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(databaseURL.hostname)||databaseURL.port!==(recovery?'55522':'55422')||databaseURL.pathname!=='/postgres')throw new Error('API checks require the matching isolated local database.');
const api=recovery?'http://127.0.0.1:8181':'http://127.0.0.1:8080';const service=process.env.SUPABASE_SERVICE_ROLE_KEY;const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=new pg.Client({connectionString:process.env.PILOT_ADMIN_DATABASE_URL});await admin.connect();
const users=[];let checks=0;
const faultName=`pilot_fault_${crypto.randomBytes(6).toString('hex')}`;
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

 const foreignCategory=(await admin.query("INSERT INTO categories(user_id,name,type,is_default,color,icon) VALUES($1,'Private fixture','EXPENSE',true,'#000000','fixture') RETURNING id",[b.id])).rows[0].id;
 assert.equal((await rpc(a,'CategoryService','ListCategories')).categories?.some(x=>x.id===foreignCategory)??false,false,'Only explicitly shared global defaults may cross ownership boundaries');
 await rpc(a,'TransactionService','CreateTransaction',{accountId:account.id,categoryId:foreignCategory,amountPaise:'1',description:'Wrong category',date:new Date().toISOString(),type:'EXPENSE'},400);
 const foreignTransaction=(await rpc(b,'TransactionService','CreateTransaction',{accountId:other.id,amountPaise:'1',description:'Private transaction',date:new Date().toISOString(),type:'EXPENSE'})).transaction;
 await rpc(a,'TransactionService','GetTransaction',{id:foreignTransaction.id},404);
 await rpc(a,'TransactionService','UpdateTransaction',{id:foreignTransaction.id,description:'Wrong owner'},404);
 await rpc(a,'TransactionService','DeleteTransaction',{id:foreignTransaction.id},404);
 const foreignGoal=(await rpc(b,'GoalService','CreateGoal',{name:'Private goal',targetAmountPaise:'10000'})).goal;
 await rpc(a,'PilotService','UpdatePaydayPlan',{config:{nextPayday:indiaDate(7),payingAccountIds:[account.id],selectedGoalId:foreignGoal.id,goalReservedPaise:'1'}},400);
 const foreignReceipt=(await rpc(b,'ReceiptService','CreateReceipt',{merchant:'Local fixture',amountPaise:'1',purchaseDate:new Date().toISOString(),ocrPayloadEncrypted:'encrypted-local-fixture'})).receipt;
 await rpc(a,'ReceiptService','UpdateReceipt',{id:foreignReceipt.id,reimbursable:true},404);
 assert.equal((await rpc(a,'ReceiptService','ListReceipts')).receipts?.some(x=>x.id===foreignReceipt.id)??false,false);
 const foreignRule=(await rpc(b,'RecurringService','CreateRuleFromCandidate',{merchantNorm:'Private bill',amountPaise:'1',cadence:'monthly',nextDueDate:`${indiaDate(1)}T12:00:00+05:30`,type:'EXPENSE',accountId:other.id})).rule;
 await rpc(a,'PilotService','RecordObligationPayment',{recurringRuleId:foreignRule.id,occurrenceDate:indiaDate(1)},404);
 pass('real auth, account ownership and direct REST isolation');

 const firstAction=(await rpc(a,'PilotService','GetPaydayPlan')).actions[0];
 const snoozed=await rpc(a,'PilotService','SetActionState',{actionId:firstAction.actionId,state:'SNOOZED',snoozeUntil:new Date(Date.now()+3600000).toISOString()});
 assert.equal(snoozed.state,'SNOOZED');
 await rpc(a,'PilotService','SetActionState',{actionId:firstAction.actionId,state:'COMPLETED'});
 assert.equal((await rpc(a,'PilotService','GetPaydayPlan')).actions.find(x=>x.actionId===firstAction.actionId).state,'COMPLETED');
 assert.equal((await rpc(b,'PilotService','GetPaydayPlan')).actions.find(x=>x.actionId===firstAction.actionId).state,'OPEN','Action state must be isolated per user');
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
 const scenario=await rpc(a,'PilotService','GetPaydayPlan',{scenarioExtraOutflowPaise:'5000'});
 assert.equal(scenario.dayProjections[0].safeToSpendPaise,'825000');
 assert.equal((await rpc(a,'PilotService','GetPaydayPlan')).dayProjections[0].safeToSpendPaise,'830000','Scenario must not change persisted plan');
 const billAccount=(await rpc(a,'AccountService','CreateAccount',{accountType:'CASH',institutionName:'Local',accountName:'Bill account',balancePaise:'10000',currency:'INR'})).account;
 await rpc(a,'PilotService','ConfirmAccountBalance',{accountId:billAccount.id,balancePaise:'10000'});
 const bill=(await rpc(a,'RecurringService','CreateRuleFromCandidate',{merchantNorm:'Local bill fixture',amountPaise:'20000',cadence:'monthly',nextDueDate:`${indiaDate(1)}T12:00:00+05:30`,type:'EXPENSE',accountId:billAccount.id})).rule;
 const accountPlan=(await rpc(a,'PilotService','UpdatePaydayPlan',{config:{...config,payingAccountIds:[account.id,billAccount.id]}})).plan;
 assert.equal(accountPlan.accounts.find(x=>x.accountId===billAccount.id).firstShortfallDate,indiaDate(1));
 assert.equal(accountPlan.accounts.find(x=>x.accountId===billAccount.id).lowestProjectedBalancePaise,'-10000');
 assert.ok(accountPlan.warnings.some(x=>x.code.startsWith('ACCOUNT_SHORTFALL')));
 await rpc(a,'PilotService','RecordObligationPayment',{recurringRuleId:bill.id,occurrenceDate:indiaDate(1)});
 const paid=await rpc(a,'PilotService','GetPaydayPlan');
 assert.equal(paid.accounts.find(x=>x.accountId===billAccount.id).lowestProjectedBalancePaise,'-10000','A payment made after the snapshot must reduce current cash once');
 assert.equal(paid.dayProjections.reduce((total,day)=>total+BigInt(day.expectedObligationsPaise??0),0n),20000n,'Paid obligation and its ledger payment must not both be deducted');
 await rpc(a,'PilotService','ConfirmAccountBalance',{accountId:billAccount.id,balancePaise:'-10000'});
 const refreshedPaid=await rpc(a,'PilotService','GetPaydayPlan');
 assert.equal(refreshedPaid.accounts.find(x=>x.accountId===billAccount.id).lowestProjectedBalancePaise,'-10000','A current snapshot already reflecting payment must not be charged again');
 assert.equal(refreshedPaid.dayProjections.reduce((total,day)=>total+BigInt(day.expectedObligationsPaise??0),0n),0n);
 await rpc(a,'RecurringService','DeleteRule',{id:bill.id});
 await rpc(a,'PilotService','UpdatePaydayPlan',{config});
 pass('server scenarios, account-specific shortages and paid-obligation exclusion');

 const text=`date,description,amount\n${indiaDate()},Import fixture,-100.29\n${indiaDate()},Import fixture,-100.29\nnot-a-date,Rejected fixture,-10\n`;
 const preview=await rpc(a,'ImportService','PreviewStatement',{accountId:account.id,fileName:'fixture.csv',file:Buffer.from(text).toString('base64'),format:'generic',openingBalancePaise:'1000000',closingBalancePaise:'979942'});
 assert.equal(preview.rows.length,2);assert.equal(preview.rejected.length,1,'Every invalid row must be explained');assert.equal(preview.reconciliation.matches,true);
 const commit={previewToken:preview.previewToken,idempotencyKey:crypto.randomUUID(),skipRowNumbers:preview.rejected.map(x=>x.rowNumber)};
 const imported=await rpc(a,'ImportService','CommitStatementImport',commit);assert.equal(imported.createdCount,2,'Genuine repeated transactions must be preserved');
 const repeated=await rpc(a,'ImportService','CommitStatementImport',commit);assert.equal(repeated.batchId,imported.batchId);
 const unchanged=(await rpc(a,'AccountService','ListAccounts')).accounts.find(x=>x.id===account.id);assert.equal(unchanged.balancePaise,'1000000','Import must not double-adjust current account snapshots');
 assert.equal((await rpc(a,'PilotService','GetPaydayPlan')).dayProjections[0].safeToSpendPaise,'830000','Date-only statement rows already covered by a current balance must not be replayed in the forecast');
 pass('authoritative preview, row explanations, exact reconciliation, atomic idempotent import');
 const existingPayment=(await rpc(a,'TransactionService','ListTransactions',{accountId:account.id,type:'EXPENSE',search:'Import fixture',pageSize:50})).transactions[0];
 const linkedBill=(await rpc(a,'RecurringService','CreateRuleFromCandidate',{merchantNorm:'Already imported bill',amountPaise:'10029',cadence:'monthly',nextDueDate:`${indiaDate()}T12:00:00+05:30`,type:'EXPENSE',accountId:account.id})).rule;
 const countBeforeLink=Number((await admin.query('SELECT count(*) FROM transactions WHERE user_id=$1',[a.id])).rows[0].count);
 await rpc(a,'PilotService','RecordObligationPayment',{recurringRuleId:linkedBill.id,occurrenceDate:indiaDate(),transactionId:foreignTransaction.id},400);
 const paidLink=await rpc(a,'PilotService','RecordObligationPayment',{recurringRuleId:linkedBill.id,occurrenceDate:indiaDate(),transactionId:existingPayment.id});
 const retriedLink=await rpc(a,'PilotService','RecordObligationPayment',{recurringRuleId:linkedBill.id,occurrenceDate:indiaDate(),transactionId:existingPayment.id});
 assert.equal(retriedLink.paymentId,paidLink.paymentId);
 assert.equal(Number((await admin.query('SELECT count(*) FROM transactions WHERE user_id=$1',[a.id])).rows[0].count),countBeforeLink,'Linking an imported payment must never create a second expense');
 const otherBill=(await rpc(a,'RecurringService','CreateRuleFromCandidate',{merchantNorm:'Another bill',amountPaise:'10029',cadence:'monthly',nextDueDate:`${indiaDate()}T12:00:00+05:30`,type:'EXPENSE',accountId:account.id})).rule;
 await rpc(a,'PilotService','RecordObligationPayment',{recurringRuleId:otherBill.id,occurrenceDate:indiaDate(),transactionId:existingPayment.id},400);
 await rpc(a,'RecurringService','DeleteRule',{id:linkedBill.id});await rpc(a,'RecurringService','DeleteRule',{id:otherBill.id});
 pass('existing imported bill links, repeat confirmation and payment-reuse protection');

 const concurrentText=`date,description,amount\n${indiaDate()},Concurrent fixture,-1\n`;
 const concurrentPreview=await rpc(a,'ImportService','PreviewStatement',{accountId:account.id,fileName:'concurrent.csv',file:Buffer.from(concurrentText).toString('base64'),format:'generic'});
 const concurrentCommit={previewToken:concurrentPreview.previewToken,idempotencyKey:crypto.randomUUID()};
 const parallel=await Promise.all(Array.from({length:4},()=>rpc(a,'ImportService','CommitStatementImport',concurrentCommit)));
 assert.equal(new Set(parallel.map(x=>x.batchId)).size,1,'Concurrent submissions must share one result');
 assert.equal(Number((await admin.query("SELECT count(*) FROM transactions WHERE user_id=$1 AND description='Concurrent fixture'",[a.id])).rows[0].count),1);
 const candidate=await rpc(a,'ImportService','PreviewStatement',{accountId:account.id,fileName:'concurrent.csv',file:Buffer.from(concurrentText).toString('base64'),format:'generic'});
 assert.equal(candidate.duplicates.length,1);
 const kept=await rpc(a,'ImportService','CommitStatementImport',{previewToken:candidate.previewToken,idempotencyKey:crypto.randomUUID(),skipRowNumbers:[]});
 assert.equal(kept.createdCount,1,'User-confirmed repeated purchase must remain importable');
 const failureText=`date,description,amount\n${indiaDate()},Rollback first ${faultName},-1\n${indiaDate()},Rollback fail ${faultName},-2\n`;
 const failurePreview=await rpc(a,'ImportService','PreviewStatement',{accountId:account.id,fileName:'rollback.csv',file:Buffer.from(failureText).toString('base64'),format:'generic'});
 const failingCommit={previewToken:failurePreview.previewToken,idempotencyKey:crypto.randomUUID()};
 await admin.query(`CREATE FUNCTION ${faultName}() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.description='Rollback fail ${faultName}' THEN RAISE EXCEPTION 'Injected local test failure'; END IF; RETURN NEW; END$$`);
 await admin.query(`CREATE TRIGGER ${faultName} BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION ${faultName}()`);
 try {
   await rpc(a,'ImportService','CommitStatementImport',failingCommit,500);
   assert.equal(Number((await admin.query('SELECT count(*) FROM transactions WHERE user_id=$1 AND description LIKE $2',[a.id,`Rollback % ${faultName}`])).rows[0].count),0,'Infrastructure failure must roll back all earlier rows');
 } finally {await admin.query(`DROP TRIGGER IF EXISTS ${faultName} ON transactions`);await admin.query(`DROP FUNCTION IF EXISTS ${faultName}()`);}
 const recovered=await rpc(a,'ImportService','CommitStatementImport',failingCommit);assert.equal(recovered.createdCount,2);
 pass('concurrent imports, explicit duplicate inclusion and failed-write rollback/recovery');

 const destination=(await rpc(a,'AccountService','CreateAccount',{accountType:'CASH',institutionName:'Local',accountName:'Wallet',balancePaise:'10000',currency:'INR'})).account;
 await rpc(a,'PilotService','UpdatePaydayPlan',{config:{...config,payingAccountIds:[account.id,destination.id]}});
 const beforeTransfer=await rpc(a,'PilotService','GetPaydayPlan');
 const transfer=await rpc(a,'PilotService','CreateTransfer',{fromAccountId:account.id,toAccountId:destination.id,amountPaise:'20000',date:new Date().toISOString(),description:'Own-account transfer',idempotencyKey:crypto.randomUUID()});
 const debit=(await rpc(a,'TransactionService','GetTransaction',{id:transfer.debitTransactionId})).transaction;const credit=(await rpc(a,'TransactionService','GetTransaction',{id:transfer.creditTransactionId})).transaction;
 assert.equal(debit.type,'TRANSFER');assert.equal(credit.type,'TRANSFER');assert.equal(debit.transferDirection,'OUT');assert.equal(credit.transferDirection,'IN');
 const afterTransfer=await rpc(a,'PilotService','GetPaydayPlan');
 assert.equal(afterTransfer.dayProjections[0].safeToSpendPaise,beforeTransfer.dayProjections[0].safeToSpendPaise,'Internal selected-account transfers must not consume spending room');
 assert.equal(afterTransfer.dayProjections[0].closingBalancePaise,beforeTransfer.dayProjections[0].closingBalancePaise);
 await rpc(a,'TransactionService','DeleteTransaction',{id:debit.id},400);
 await rpc(a,'TransactionService','UpdateTransaction',{id:credit.id,amountPaise:'3'},400);
 await rpc(a,'TransactionService','CreateTransaction',{accountId:account.id,amountPaise:'1',description:'Unpaired transfer',date:new Date().toISOString(),type:'TRANSFER'},400);


 const creditCard=(await rpc(a,'AccountService','CreateAccount',{accountType:'CREDIT_CARD',institutionName:'Local',accountName:'Pilot card',balancePaise:'-10000',currency:'INR'})).account;
 const summaryBefore=await rpc(a,'InsightsService','GetSummary',{monthYear:indiaDate().slice(0,7)});
 await rpc(a,'PilotService','CreateTransfer',{fromAccountId:account.id,toAccountId:creditCard.id,amountPaise:'10000',date:new Date().toISOString(),description:'Confirmed card payment',idempotencyKey:crypto.randomUUID()});
 const summaryAfter=await rpc(a,'InsightsService','GetSummary',{monthYear:indiaDate().slice(0,7)});
 assert.deepEqual(summaryAfter,summaryBefore,'A confirmed card payment is an owned-account transfer, not a second expense');
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
 const deletionGoal=(await rpc(a,'GoalService','CreateGoal',{name:'Reserved pilot goal',targetAmountPaise:'100000'})).goal;
 await rpc(a,'PilotService','UpdatePaydayPlan',{config:{...config,selectedGoalId:deletionGoal.id,goalReservedPaise:'10000'}});
 const exportedUser=await fetch(`${api}/lifecycle/export`,{method:'POST',headers:{Authorization:`Bearer ${a.token}`}});assert.equal(exportedUser.status,200);const data=await exportedUser.json();assert.ok(JSON.stringify(data).includes('Export fixture'));
 const deleted=await fetch(`${api}/lifecycle/delete`,{method:'POST',headers:{Authorization:`Bearer ${a.token}`,'Content-Type':'application/json'},body:JSON.stringify({idempotencyKey:crypto.randomUUID(),confirm:'DELETE'})});
 assert.ok([200,202].includes(deleted.status),`Deletion failed (${deleted.status})`);const deletion=await deleted.json();assert.equal(deletion.status,'COMPLETED');assert.equal(Number((await admin.query('SELECT count(*) FROM transactions WHERE user_id=$1',[a.id])).rows[0].count),0);assert.equal(Number((await admin.query('SELECT count(*) FROM auth.users WHERE id=$1',[a.id])).rows[0].count),0);
 pass('current-user export and complete local data/auth deletion');
 console.log(`${checks} authenticated pilot API scenario groups passed.`);
}finally{
 await admin.query(`DROP TRIGGER IF EXISTS ${faultName} ON transactions`);await admin.query(`DROP FUNCTION IF EXISTS ${faultName}()`);
 for(const id of users){try{await auth(`admin/users/${id}`,undefined,service,'DELETE');}catch{/* already deleted or cleanup reported separately */}}
 await admin.end();
}
