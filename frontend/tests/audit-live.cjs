// Runs only against the disposable localhost audit containers. Never load .env files.
const assert=require('node:assert/strict');
const http=require('node:http');
const crypto=require('node:crypto');
const {NextRequest}=require('next/server');
const {load}=require('./server-loader.cjs');
Object.assign(process.env,{DATABASE_URL:'postgres://postgres:misa-disposable-audit-only@127.0.0.1:55433/misa_audit',DRAGONFLY_URL:'redis://127.0.0.1:56380/0',MISA_NEXT_CORE_ROLLOUT:'true',MISA_ENVIRONMENT:'development',MISA_TRUST_PROXY:'false',DATA_API_KEY:'disposable-audit-key',MISA_ADMIN_TOKEN_SECRET:'disposable-audit-admin-key',MISA_EMAIL_API_KEY:'disposable-capture-key',SUPER_ADMIN_EMAIL:'unrelated@example.com'});
const next=require('next/server');const deferred=[];
const adapters={'next/server':{...next,after:fn=>deferred.push(fn)},'./turnstile':{verifyTurnstile:async()=>true}};
const messages=[];
const capture=http.createServer((req,res)=>{let raw='';req.on('data',part=>raw+=part);req.on('end',()=>{messages.push(JSON.parse(raw));res.writeHead(200,{'content-type':'application/json'});res.end('{"id":"local-capture"}');});});
function req(path,body,cookie='',method=body===undefined?'GET':'POST'){return new NextRequest('https://misa.lol'+path,{method,headers:{'content-type':'application/json',cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function drain(){while(deferred.length)await deferred.shift()();}
async function main(){
 await new Promise(resolve=>capture.listen(0,'127.0.0.1',resolve));process.env.MISA_EMAIL_API_URL=`http://127.0.0.1:${capture.address().port}/emails`;
 const db=load('lib/server/postgres.ts').database();const redis=load('lib/server/redis.ts').redis();await redis.connect();
 const suffix=crypto.randomBytes(5).toString('hex'),email=`audit-${suffix}@example.com`,username=`audit_${suffix}`;
 const rate=load('lib/server/rate-limit.ts');const limitKey='audit:limit:'+suffix;
 const outcomes=await Promise.all(Array.from({length:100},()=>rate.withinLimit(limitKey,10,60)));assert.equal(outcomes.filter(Boolean).length,10);assert.ok(await redis.ttl(limitKey)>0);
 await redis.set(limitKey,1);await rate.withinLimit(limitKey,10,60);assert.ok(await redis.ttl(limitKey)>0);
 console.log('PASS real Dragonfly: concurrent atomic rate limit and permanent-key recovery');
 const signup=load('app/api/v1/auth/signup/route.ts',adapters);let response=await signup.POST(req('/api/v1/auth/signup',{email,password:'audit-password-123',confirm_password:'audit-password-123',tos:true,turnstile_token:'test-adapter'}));assert.equal(response.status,200,await response.clone().text());
 const cookie=response.cookies.get('misa_session').value;const sessionCookie='misa_session='+cookie;
 await drain();assert.equal(messages.length,1);const verification=new URL(messages[0].text.match(/https:\/\/misa\.lol\/api\/v1\/auth\/confirm-email\?token=[\w-]+/)[0]);
 let account=(await db.query('SELECT * FROM users WHERE email=$1',[email])).rows[0];assert.equal(account.email_verified,false);assert.ok(account.password_hash.startsWith('$argon2'));assert.equal(account.display_name,'New member');
 await db.query('UPDATE users SET username=$2 WHERE id=$1',[account.id,username]);
 const confirm=load('app/api/v1/auth/confirm-email/route.ts');assert.match((await confirm.GET(req(verification.pathname+verification.search))).headers.get('location'),/email=confirmed/);assert.match((await confirm.GET(req(verification.pathname+verification.search))).headers.get('location'),/email=invalid/);
 account=(await db.query('SELECT * FROM users WHERE id=$1',[account.id])).rows[0];assert.equal(account.email_verified,true);
 console.log('PASS real PostgreSQL/Dragonfly: signup, Argon2, mail capture, one-time verification');
 const profile=load('app/api/v1/profile/me/route.ts');response=await profile.PUT(req('/api/v1/profile/me',{profile:{displayName:'Audit member',views:9999},settings:{accentColor:'#abc'},badges:[{id:'staff',owned:true}],assets:{}},sessionCookie,'PUT'));assert.equal(response.status,200,await response.clone().text());
 response=await profile.GET(req('/api/v1/profile/me',undefined,sessionCookie));assert.equal(response.status,200);const saved=(await response.json()).profile;assert.equal(saved.profile.views,0);assert.deepEqual(saved.badges,[]);assert.equal(saved.settings.accentColor,'#aabbcc');
 const publicProfile=await load('lib/server/profiles.ts').publicProfile(username);assert.equal(publicProfile.profile.displayName,'Audit member');assert.deepEqual(publicProfile.badges,[]);
 console.log('PASS real profile persistence/read/public projection and forged badge/view rejection');
 const login=load('app/api/v1/auth/login/route.ts',adapters);response=await login.POST(req('/api/v1/auth/login',{email,password:'wrong',turnstile_token:'test-adapter'}));assert.equal(response.status,401);
 response=await login.POST(req('/api/v1/auth/login',{email,password:'audit-password-123',turnstile_token:'test-adapter'}));assert.equal(response.status,200,await response.clone().text());const second=response.cookies.get('misa_session').value;
 const sessions=load('lib/server/sessions.ts');assert.equal((await sessions.listSessions(account.id)).length,2);await sessions.revokeOtherSessions(account.id,second);assert.equal(await sessions.currentUser(req('/',undefined,sessionCookie)),null);
 console.log('PASS password login and sign out other devices');
 const forgot=load('app/api/v1/auth/forgot/route.ts',adapters);response=await forgot.POST(req('/api/v1/auth/forgot',{email}));assert.equal(response.status,200);await drain();const resetToken=new URL(messages.at(-1).text.match(/https:\/\/misa\.lol\/reset-password\?token=[\w-]+/)[0]).searchParams.get('token');
 const reset=load('app/api/v1/auth/reset/route.ts');const resetBody={token:resetToken,password:'changed-password-123',confirm_password:'changed-password-123'};assert.equal((await reset.POST(req('/api/v1/auth/reset',resetBody))).status,200);assert.equal((await reset.POST(req('/api/v1/auth/reset',resetBody))).status,400);assert.equal(await sessions.currentUser(req('/',undefined,'misa_session='+second)),null);
 console.log('PASS captured password reset, token replay rejection and session invalidation');
 const oauth=load('lib/server/oauth-state.ts');const state=await oauth.saveOAuthState('google','/dashboard','nonce');assert.ok(await oauth.popOAuthState(state,'google'));assert.equal(await oauth.popOAuthState(state,'google'),null);assert.equal(await oauth.consumeTelegramPayload({hash:'fixture-'+suffix}),true);assert.equal(await oauth.consumeTelegramPayload({hash:'fixture-'+suffix}),false);
 console.log('PASS real Redis one-time OAuth state and Telegram payload rejection');
 await redis.quit();await db.end();await new Promise(resolve=>capture.close(resolve));
}
main().catch(async error=>{console.error(error);capture.close();if(global.__misaRedis)global.__misaRedis.disconnect();if(global.__misaPostgresPool)await global.__misaPostgresPool.end();process.exitCode=1;});
