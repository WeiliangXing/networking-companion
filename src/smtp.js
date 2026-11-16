// Gmail submission over TLS. Credentials and SMTP responses are never logged.
export async function smtpSession(socket,env,mime,recipient,{verifyOnly=false}={}){
 const reader=socket.readable.getReader(),writer=socket.writable.getWriter(),decoder=new TextDecoder(),encoder=new TextEncoder();let buffer='',submitted=false;
 async function response(expected){
  let bytes=0;
  while(true){
   const end=buffer.indexOf('\r\n');
   if(end<0){const {done,value}=await reader.read();if(done)throw Error('Gmail connection closed.');bytes+=value.length;if(bytes>32000)throw Error('Invalid Gmail response.');buffer+=decoder.decode(value,{stream:true});continue;}
   const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
   if(!/^\d{3}[ -]/.test(line))throw Error('Invalid Gmail response.');
   if(line[3]==='-')continue;
   const code=Number(line.slice(0,3));
   if(!expected.includes(code))throw Object.assign(Error(code===535?'Gmail did not accept the App Password.':'Gmail rejected the email operation ('+code+').'),{definite:true});
   return;
  }
 }
 async function command(text,codes){await writer.write(encoder.encode(text+'\r\n'));await response(codes);}
 try{
  await socket.opened;await response([220]);await command('EHLO companion.local',[250]);
  await command('AUTH LOGIN',[334]);await command(btoa(env.EMAIL_FROM),[334]);await command(btoa(env.GMAIL_APP_PASSWORD.replace(/\s/g,'')),[235]);
  if(verifyOnly)return 'authenticated';
  await command('MAIL FROM:<'+env.EMAIL_FROM+'>',[250]);await command('RCPT TO:<'+recipient+'>',[250,251]);await command('DATA',[354]);
  submitted=true;await writer.write(encoder.encode(mime.replace(/(^|\r\n)\./g,'$1..')+'\r\n.\r\n'));await response([250]);
  return 'gmail-smtp-accepted';
 }catch(e){if(!submitted)e.definite=true;throw e;}
 finally{reader.releaseLock();writer.releaseLock();await socket.close().catch(()=>{});}
}
export async function sendSmtp(env,mime,recipient,options){
 const {connect}=await import('cloudflare:sockets');
 const socket=connect({hostname:'smtp.gmail.com',port:465},{secureTransport:'on'});
 socket.closed.catch(()=>{});let timer;
 try{return await Promise.race([smtpSession(socket,env,mime,recipient,options),new Promise((_,reject)=>{timer=setTimeout(()=>{socket.close().catch(()=>{});reject(Error('Gmail timed out.'));},25000);})]);}
 finally{clearTimeout(timer);}
}
