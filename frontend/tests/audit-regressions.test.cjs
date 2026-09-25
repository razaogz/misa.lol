const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { NextRequest } = require('next/server');
const { load } = require('./server-loader.cjs');
const user = { id:'11111111-1111-4111-8111-111111111111', username:'alice', display_name:'Alice', created_at:'2026-01-01', email:'alice@example.com' };
const gate = { './rollout': {nativeCoreEnabled:()=>true}, './profile-features': {profileFeatureFlags:async()=>({}),disabledProfileChange:()=>null} };
function request(path, body, headers={}) { return new NextRequest('https://misa.lol'+path,{method:body===undefined?'GET':'PUT',headers:{'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}); }

test('session user and ban status share one indexed SQL round trip', async () => {
 const queries=[];
 const api=load('lib/server/users.ts',{'./postgres':{one:async(sql,values)=>{queries.push({sql,values});return{...user,session_banned:true};}}});
 const result=await api.sessionUserById(user.id);
 assert.equal(queries.length,1);assert.deepEqual(queries[0].values,[user.id]);
 assert.match(queries[0].sql,/EXISTS\(SELECT 1 FROM banned_accounts/);
 assert.match(queries[0].sql,/EXISTS\(SELECT 1 FROM banned_ips/);
 assert.equal(result.user.id,user.id);assert.equal(result.banned,true);
});

test('current session batches its three Redis refresh commands', async () => {
 const token='session-token',commands=[],session={user_id:user.id,last_seen_at:new Date().toISOString()};
 const client={status:'ready',get:async key=>key==='session:'+token?JSON.stringify(session):null,del:async()=>{},srem:async()=>{},pipeline(){const queued=[];const pipe={set:(...args)=>{queued.push(['set',...args]);return pipe;},expire:(...args)=>{queued.push(['expire',...args]);return pipe;},sadd:(...args)=>{queued.push(['sadd',...args]);return pipe;},exec:async()=>{commands.push(...queued);return queued.map(()=>[null,1]);}};return pipe;}};
 const api=load('lib/server/sessions.ts',{'./redis':{redis:()=>client},'./users':{sessionUserById:async()=>({user:{...user,is_admin:false,suspended_at:null,suspended_until:null},banned:false}),isSuspended:()=>false,publicUser:value=>({is_admin:value.is_admin})}});
 const req=request('/dashboard',undefined,{cookie:'misa_session='+token});
 assert.equal((await api.currentUser(req)).id,user.id);
 assert.deepEqual(commands.map(([command])=>command),['expire','sadd','expire']);
});

test('current session still revokes a banned account before refreshing Redis state', async () => {
 const token='session-token',revoked=[],session={user_id:user.id,last_seen_at:new Date().toISOString()};
 const client={status:'ready',get:async key=>key==='session:'+token?JSON.stringify(session):null,del:async key=>revoked.push(['del',key]),srem:async(key,value)=>revoked.push(['srem',key,value]),pipeline:()=>{throw new Error('Banned sessions must not refresh');}};
 const api=load('lib/server/sessions.ts',{'./redis':{redis:()=>client},'./users':{sessionUserById:async()=>({user:{...user,is_admin:false,suspended_at:null,suspended_until:null},banned:true}),isSuspended:()=>false,publicUser:value=>({is_admin:value.is_admin})}});
 const req=request('/dashboard',undefined,{cookie:'misa_session='+token});
 assert.equal(await api.currentUser(req),null);
 assert.deepEqual(revoked,[['del','session:'+token],['srem','user_sessions:'+user.id,token]]);
});

test('profile sanitizer accepts old/incomplete records and rejects forged authority, CSS and external assets',()=>{
 const api=load('lib/server/profile-persistence.ts');
 const input={profile:{displayName:'Alice',views:999,verified:true,is_admin:true},settings:{accentColor:'red; background:url(https://evil.test)',textColor:'#abc',iconColor:'#123456ab'},assets:{avatar:{url:'https://evil.test/a'},background:{url:'data:image/png;base64,AAAA'}},badges:[{id:'staff',owned:true}],rank:{id:'owner'},premium:true,socials:[{id:'gh',platform:'GitHub',value:'alice',enabled:true}]};
 const config=api.sanitizeProfilePayload(input,user,{profile:{views:123}});
 assert.equal(config.profile.views,0);assert.equal(config.profile.verified,undefined);assert.equal(config.profile.is_admin,undefined);
 assert.deepEqual(config.badges,[]);assert.equal(config.rank,undefined);assert.equal(config.premium,undefined);
 assert.equal(config.settings.accentColor,'#9b87f5');assert.equal(config.settings.textColor,'#aabbcc');assert.equal(config.settings.iconColor,'#123456');
 assert.equal(config.assets.avatar.url,null);assert.equal(config.assets.background.url,null);assert.equal(config.settings.premium,undefined);
 assert.equal(config.socials[0].value,'alice');
 assert.deepEqual(api.sanitizeProfilePayload({},user,null).badges,[]);
});

test('normalization gives incomplete profiles safe defaults without fabricated accounts or privileges',()=>{
 const api=load('lib/profile-normalize.ts');
 for(const raw of [null,{}, {profile:null,assets:{cursor:null,tracks:null},socials:[null],badges:[null],widgets:[null],sections:[null]}]) {
  const c=api.normalizeDashboardProfile(raw);
  assert.equal(c.profile.username,'');assert.equal(c.profile.displayName,'');assert.equal(c.profile.views,0);
  assert.deepEqual(c.badges,[]);assert.deepEqual(c.socials,[]);assert.deepEqual(c.assets.tracks,[]);assert.equal(c.assets.cursor.url,null);
 }
 const css=api.cssUrl('https://r2.misa.lol/a(b)";\n</style>.png?q=a&b=c');
 assert.ok(css.startsWith('url("'));assert.ok(!css.includes('</style>'));assert.ok(!css.includes('\n'));assert.ok(css.includes('a(b)'));
});

test('non-premium users can save standard settings and premium changes remain forbidden',async()=>{
 let saved;
 const actual=load('lib/server/profile-persistence.ts');
 const route=load('app/api/v1/profile/me/route.ts',{...gate,'./sessions':{currentUser:async()=>user},'./profile-persistence':{...actual,savedProfile:async()=>null,hasPremium:async()=>false,persistProfile:async(_id,c)=>(saved=c)},'./profile-assets':{cleanupProfileAssets:async()=>{}}});
 let res=await route.PUT(request('/api/v1/profile/me',{profile:{displayName:'Alice'},settings:{accentColor:'#123456'}}));
 assert.equal(res.status,200);assert.equal(saved.settings.accentColor,'#123456');assert.deepEqual(saved.badges,[]);
 res=await route.PUT(request('/api/v1/profile/me',{profile:{displayName:'Alice'},settings:{premium:{cursorEffect:'Ghost Cursor'}}}));assert.equal(res.status,403);
 res=await route.PUT(request('/api/v1/profile/me',{} ,{'content-length':'1000001'}));assert.equal(res.status,413);
 res=await route.PUT(request('/api/v1/profile/me',null));assert.equal(res.status,400);
});

test('all expected upload categories validate extension, MIME and byte signatures',()=>{
 const api=load('lib/server/upload-validation.ts');
 const samples=[['avatar','x.png','image/png',[137,80,78,71,13,10,26,10]],['background','x.jpg','image/jpeg',[255,216,255]],['backgroundVideo','x.mp4','video/mp4',[0,0,0,24,102,116,121,112]],['audio','x.mp3','audio/mpeg',[73,68,51]],['audio','x.webm','audio/webm',[26,69,223,163]],['customFont','x.woff2','font/woff2',[119,79,70,50]]];
 for(const [kind,name,mime,header] of samples){const b=Buffer.alloc(24);Buffer.from(header).copy(b);assert.equal(api.uploadMime(kind,name,mime),mime);assert.equal(api.validUploadBytes(mime,b),true);assert.equal(api.validUploadBytes(mime,Buffer.from('<html>not media</html>')),false);}
 assert.equal(api.uploadMime('avatar','x.html','image/png'),null);assert.equal(api.uploadMime('avatar','x.png','image/jpeg'),null);assert.equal(api.uploadMime('audio','x.mp3','audio/evil'),null);assert.equal(api.uploadMime('avatar','x.svg','image/svg+xml'),null);
});

test('upload route rejects unauthenticated, oversized and invalid media before R2; valid uploads store binary',async()=>{
 let loggedIn=false;let uploaded=0;
 const route=load('app/api/v1/profile/assets/route.ts',{...gate,'./sessions':{currentUser:async()=>loggedIn?user:null},'./r2':{uploadToR2:async(key,body,type)=>{uploaded++;assert.ok(key.startsWith('profiles/'+user.id+'/avatar/'));assert.equal(type,'image/png');assert.ok(body instanceof Uint8Array);return 'https://r2.misa.lol/'+key;}}});
 const send=(bytes,name='avatar.png',type='image/png',headers={})=>{const form=new FormData();form.set('kind','avatar');form.set('file',new File([bytes],name,{type}));return route.POST(new NextRequest('https://misa.lol/api/v1/profile/assets',{method:'POST',body:form,headers}));};
 assert.equal((await send('x')).status,401);loggedIn=true;
 assert.equal((await send('x','x.png','image/png',{'content-length':'111000001'})).status,413);
 assert.equal((await send('x','x.html')).status,400);assert.equal((await send('not an image')).status,400);
 const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);
 const res=await send(b);assert.equal(res.status,200);assert.ok((await res.json()).asset.url.startsWith('https://'));assert.equal(uploaded,1);
});

test('R2 replacement/deletion keeps live references and cannot delete another user objects',async()=>{
 const old=process.env.R2_PUBLIC_BASE_URL;process.env.R2_PUBLIC_BASE_URL='https://r2.misa.lol';
 try {
  let used=false;const deleted=[];
  const api=load('lib/server/profile-assets.ts',{'./postgres':{one:async()=>({used})},'./r2':{deleteFromR2:async key=>deleted.push(key)}});
  const url=`https://r2.misa.lol/profiles/${user.id}/avatar/old.png`;
  assert.equal(api.ownedAssetKey('https://evil.test/profiles/'+user.id+'/a',user.id),null);
  assert.equal(api.ownedAssetKey('https://r2.misa.lol/profiles/other/a',user.id),null);
  await api.cleanupProfileAssets(user.id,{avatar:{url}},{avatar:{url}});assert.equal(deleted.length,0);
  used=true;await api.cleanupProfileAssets(user.id,{avatar:{url}},{});assert.equal(deleted.length,0);
  used=false;await api.cleanupProfileAssets(user.id,{avatar:{url}},{});assert.equal(deleted.length,1);
 }finally{if(old===undefined)delete process.env.R2_PUBLIC_BASE_URL;else process.env.R2_PUBLIC_BASE_URL=old;}
});

test('OAuth callbacks reject a mismatched browser before consuming server state',async()=>{
 let popped=0;
 const state='a'.repeat(43);const actual=load('lib/server/oauth-state.ts');
 const api=load('lib/server/oauth-routes.ts',{...gate,'./oauth-state':{...actual,popOAuthState:async()=>{popped++;return null;}}});
 for(const headers of [{},{cookie:'misa_oauth_google='+'b'.repeat(43)}]){const res=await api.callbackOAuth(new NextRequest(`https://misa.lol/api/v1/auth/google/callback?state=${state}&code=x`,{headers}),'google');assert.match(res.headers.get('location'),/oauth_failed/);}
 assert.equal(popped,0);
 await api.callbackOAuth(new NextRequest(`https://misa.lol/api/v1/auth/google/callback?state=${state}&code=x`,{headers:{cookie:'misa_oauth_google='+state}}),'google');assert.equal(popped,1);
});

test('OAuth entry binds a short-lived HttpOnly cookie; Apple POST callbacks use Secure SameSite=None',async()=>{
 const actual=load('lib/server/oauth-state.ts');
 const api=load('lib/server/oauth-routes.ts',{...gate,'./rate-limit':{withinLimit:async()=>true},'./oauth-state':{...actual,saveOAuthState:async()=> 'a'.repeat(43)},'./oauth-provider':{providerEnabled:()=>true,authorizeUrl:()=> 'https://provider.example/auth'}});
 for(const provider of ['google','discord','telegram','apple']) {
  const response=await api.startOAuth(request('/api/v1/auth/'+provider),provider);
  const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/Max-Age=600/i);assert.match(cookie,provider==='apple'?/SameSite=none/i:/SameSite=lax/i);
 }
});

test('Telegram payloads expire after five minutes and replay consumption is atomic',async()=>{
 const keys=new Set();let ttl;
 const api=load('lib/server/oauth-state.ts',{'./redis':{redis:()=>({status:'ready',set:async(key,_v,ex,seconds,nx)=>{assert.equal(ex,'EX');assert.equal(nx,'NX');ttl=seconds;if(keys.has(key))return null;keys.add(key);return 'OK';}})}});
 const now=1700000000,token='fixture';const payload={id:'123',auth_date:String(now-301)};
 payload.hash=crypto.createHmac('sha256',crypto.createHash('sha256').update(token).digest()).update(Object.keys(payload).sort().map(k=>k+'='+payload[k]).join('\n')).digest('hex');
 assert.equal(api.verifyTelegramAuth(payload,token,now),false);
 assert.deepEqual(await Promise.all([api.consumeTelegramPayload(payload),api.consumeTelegramPayload(payload)]),[true,false]);assert.equal(ttl,301);
});

test('Telegram bridge decodes base64url with both special characters and Unicode',async()=>{
 const api=load('lib/server/oauth-routes.ts',{...gate,'./oauth-provider':{providerEnabled:()=>true}});
 const response=await api.callbackOAuth(request('/api/v1/auth/telegram/callback?state=abc'),'telegram');
 const html=await response.text();const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const payload={id:123,hash:'signature',first_name:'\uffff\ufffe',auth_date:1};
 const raw=Buffer.from(JSON.stringify(payload)).toString('base64url');assert.ok(raw.includes('_'));assert.ok(raw.includes('-'));
 let target;vm.runInNewContext(script,{TextDecoder,Uint8Array,atob,URLSearchParams,location:{hash:'#tgAuthResult='+raw,pathname:'/api/v1/auth/telegram/callback',search:'?state=abc',replace:value=>{target=value;}},history:{replaceState(){}}});
 const params=new URL(target,'https://misa.lol').searchParams;assert.equal(params.get('first_name'),payload.first_name);assert.equal(params.get('state'),'abc');
});

test('rate-limit updates counter and expiration in one Redis operation',async()=>{
 let calls=0;
 const api=load('lib/server/rate-limit.ts',{'./redis':{redis:()=>({status:'ready',eval:async(script,num,key,ttl)=>{assert.match(script,/INCR/);assert.match(script,/TTL/);assert.match(script,/EXPIRE/);assert.equal(num,1);assert.equal(ttl,60);return ++calls;}})}});
 assert.equal(await api.withinLimit('key',1,60),true);assert.equal(await api.withinLimit('key',1,60),false);
});

test('untrusted proxy headers cannot supply a client IP or downgrade secure cookies',()=>{
 const old=process.env.MISA_TRUST_PROXY;delete process.env.MISA_TRUST_PROXY;
 try {
  const ip=load('lib/server/client-ip.ts'),cookies=load('lib/server/cookies.ts');const req=request('/',undefined,{'cf-connecting-ip':'8.8.8.8','x-forwarded-proto':'http'});
  assert.equal(ip.clientIp(req),'unknown');assert.equal(cookies.cookieSecure(req),true);
  process.env.MISA_TRUST_PROXY='true';assert.equal(ip.clientIp(req),'8.8.8.8');assert.equal(ip.clientIp(request('/',undefined,{'x-forwarded-for':'8.8.8.8, 1.1.1.1'})),'unknown');
 }finally{if(old===undefined)delete process.env.MISA_TRUST_PROXY;else process.env.MISA_TRUST_PROXY=old;}
});

test('username availability checks persisted state and rejects reserved paths',async()=>{
 let taken=false;let calls=0;
 const route=load('app/api/v1/auth/available/route.ts',{...gate,'./rate-limit':{withinLimit:async()=>true},'./postgres':{one:async()=>{calls++;return {taken,reserved:false};}}});
 assert.equal((await (await route.GET(request('/api/v1/auth/available?username=alice'))).json()).available,true);
 taken=true;assert.equal((await (await route.GET(request('/api/v1/auth/available?username=alice'))).json()).available,false);
 const before=calls;for(const name of ['security','preview','leaderboard','constellations','.env','wp-login.php'])assert.equal((await (await route.GET(request('/api/v1/auth/available?username='+name))).json()).available,false);assert.equal(calls,before);
});

test('invalid public profile names avoid the database and stored badges/views cannot survive an empty authoritative result',async()=>{
 let looked=0;
 const api=load('lib/server/profiles.ts',{'./profile-features':{profileFeatureFlags:async()=>({}),projectProfileFeatures:c=>c},'./users':{userByUsername:async()=>{looked++;return user;},isSuspended:()=>false},'./postgres':{one:async(sql)=>sql.includes('profile_stats')?{views:7}:{config:{profile:{views:999},badges:[{id:'staff',owned:true,enabled:true}]}},database:()=>({query:async()=>({rows:[]})})},'./premium':{hasActivePremium:async()=>false,publicProjection:c=>c},'./achievements':{currentRankForUser:async()=>null}});
 assert.equal(await api.publicProfile('.env'),null);assert.equal(await api.publicProfile('wp-login.php'),null);assert.equal(looked,0);
 const config=await api.publicProfile('alice');assert.deepEqual(config.badges,[]);assert.equal(config.profile.views,7);
});

test('public audio handles byte ranges and blocks unapproved storage hosts',async()=>{
 const api=load('lib/server/media.ts');const audio='data:audio/mpeg;base64,'+Buffer.from('0123456789').toString('base64');
 const res=await api.publicAudio(new Request('https://misa.lol',{headers:{range:'bytes=2-5'}}),audio);assert.equal(res.status,206);assert.equal(await res.text(),'2345');
 assert.equal(await api.publicAudio(new Request('https://misa.lol'),'https://evil.test/audio.mp3'),null);
});

test('public and dashboard share renderer and reset restores persisted state',()=>{
 const publicView=fs.readFileSync(require('node:path').join(__dirname,'../components/profile/PublicProfileView.tsx'),'utf8');
 const customizer=fs.readFileSync(require('node:path').join(__dirname,'../components/customization/CustomizationWorkspace.tsx'),'utf8');
 const overview=fs.readFileSync(require('node:path').join(__dirname,'../components/dashboard/Overview.tsx'),'utf8');
 const sharedPreview=fs.readFileSync(require('node:path').join(__dirname,'../components/profile/LiveProfilePreview.tsx'),'utf8');
 const store=fs.readFileSync(require('node:path').join(__dirname,'../lib/profile-store.tsx'),'utf8');
 assert.match(publicView,/<ProfileRenderer/);assert.match(customizer,/LiveProfilePreview/);assert.match(overview,/LiveProfilePreview/);assert.match(sharedPreview,/<ProfileRenderer/);assert.match(store,/resetConfig:.*structuredClone\(savedConfig\)/);
});


test('verified OAuth claims create a separate identity and preserve an unverified password account',async()=>{
 const calls=[];
 const owner={...user,email_verified:false,password_hash:'attacker-password'};
 const api=load('lib/server/oauth-users.ts',{'./postgres':{database:()=>({connect:async()=>({query:async(sql,args)=>{
  calls.push([sql,args]);
  if(sql.includes('WHERE google_id'))return {rows:[]};
  if(sql.includes('SELECT * FROM users WHERE lower(email)'))return {rows:[owner]};
  if(sql==='SELECT * FROM users WHERE id=$1')return {rows:[{id:args[0]}]};
  return {rows:[],rowCount:1};
 },release(){}})})}});
 const result=await api.upsertOAuthUser({provider:'google',providerId:'subject',email:user.email,emailVerified:true,displayName:'Alice',avatarUrl:null},null);
 assert.notEqual(result.id,user.id);assert.equal(calls.some(([sql])=>sql.startsWith('UPDATE users SET email=NULL')),false);assert.ok(calls.some(([sql,args])=>sql.startsWith('INSERT INTO users')&&args[2]===null));assert.equal(calls.at(-1)[0],'COMMIT');
 assert.equal(calls.some(([sql])=>/UPDATE users SET.*password_hash/.test(sql)),false);
});

test('password signup uses Argon2, sends a verification link and preserves secure session issuance',async()=>{
 const background=[],sent=[];let created;
 const realNext=require('next/server');
 const route=load('app/api/v1/auth/signup/route.ts',{...gate,'next/server':{...realNext,after:fn=>background.push(fn)},argon2:{hash:async password=>{assert.equal(password,'correct-password');return '$argon2id$fixture';}},'./rate-limit':{withinLimit:async()=>true},'./turnstile':{verifyTurnstile:async()=>true},'./account-bans':{requestIpIsBanned:async()=>false,rememberSignupIp:async()=>{}},'./users':{userByEmail:async()=>null,createEmailUser:async(email,hash,name)=>{created={email,hash,name};return user;},touchLogin:async()=>{}},'./sessions':{SESSION_COOKIE:'misa_session',destroySession:async()=>{},createSession:async()=>({token:'opaque',ttl:600}),attachSession:response=>response.cookies.set('misa_session','opaque',{httpOnly:true,secure:true,sameSite:'lax'})},'./account-security':{rememberSwitcherUser(){}},'./account-tokens':{putAccountToken:async(kind,payload)=>{assert.equal(kind,'email_change');assert.equal(payload.user_id,user.id);return 'verification-token';}},'./account-mail':{mailerConfigured:()=>true,publicOrigin:()=> 'https://misa.lol',sendAccountMail:async(...args)=>{sent.push(args);return true;}}});
 const response=await route.POST(new NextRequest('https://misa.lol/api/v1/auth/signup',{method:'POST',body:JSON.stringify({email:user.email,password:'correct-password',confirm_password:'correct-password',tos:true,turnstile_token:'fixture'})}));
 assert.equal(response.status,200);assert.equal(created.hash,'$argon2id$fixture');assert.equal(created.name,'New member');assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.equal(background.length,1);
 await background[0]();assert.equal(sent[0][0],user.email);assert.match(sent[0][2],/confirm-email\?token=verification-token$/);
});

test('email confirmation consumes a token once before commit and replay cannot mutate the account',async()=>{
 let available=true;let updates=0;const calls=[];
 const route=load('app/api/v1/auth/confirm-email/route.ts',{...gate,'./users':{userByEmail:async()=>null},'./account-tokens':{peekAccountToken:async()=>available?{user_id:user.id,email:user.email}:null,popAccountToken:async()=>{if(!available)return null;available=false;return {user_id:user.id};}},'./postgres':{database:()=>({connect:async()=>({query:async sql=>{calls.push(sql);if(sql.startsWith('UPDATE'))updates++;return {rowCount:1};},release(){}})})}});
 const send=()=>route.GET(request('/api/v1/auth/confirm-email?token=verification-token'));
 assert.match((await send()).headers.get('location'),/email=confirmed/);assert.match((await send()).headers.get('location'),/email=invalid/);assert.equal(updates,1);assert.equal(calls.at(-1),'COMMIT');
});

test('feature flags enforce disabled uploads, settings and public display on the server',()=>{
 const normal=load('lib/profile-normalize.ts');const api=load('lib/server/profile-features.ts');
 const original=normal.profileDefaults(),next=structuredClone(original);next.assets.avatar.url='https://r2.misa.lol/avatar.png';
 assert.match(api.disabledProfileChange(next,original,{'customize.assets.avatar':false}),/disabled/);
 assert.equal(api.disabledProfileChange(original,original,{'customize.assets.avatar':false}),null);
 const projected=api.projectProfileFeatures(next,{'profile.avatar':false,'profile.views':false,'profile.audio':false});
 assert.equal(projected.settings.showAvatar,false);assert.equal(projected.settings.showViews,false);assert.equal(projected.assets.audioEnabled,false);assert.equal(next.settings.showAvatar,true);
});

test('server projections preserve legacy readable media but never persist new data URLs',()=>{
 const api=load('lib/server/profile-persistence.ts');const url='data:image/png;base64,AAAA';
 assert.equal(api.sanitizeProfilePayload({assets:{background:{url}}},user,null,true).assets.background.url,url);
 assert.equal(api.sanitizeProfilePayload({assets:{background:{url}}},user,null,false).assets.background.url,null);
});
