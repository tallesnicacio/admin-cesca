#!/usr/bin/env node
const https = require('https');

const email = 'talles.nicacio@gmail.com';
const telefone = '(27) 98839-3712';

console.log('\n🧪 TESTANDO EDGE FUNCTION verificar-suspensao\n');
console.log('Email:', email);
console.log('Telefone:', telefone);
console.log('');

const postData = JSON.stringify({ email, telefone });

const options = {
  hostname: 'mmfsesanudlzgfbjlpzk.supabase.co',
  port: 443,
  path: '/functions/v1/verificar-suspensao',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZnNlc2FudWRsemdmYmpscHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNTE4NDMsImV4cCI6MjA3NjgyNzg0M30.o8piHPU3oeDRIaKUWQ5oXePhbxSxQRVrVNa56Po6Eog',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🚀 Chamando Edge Function...\n');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('📊 Status HTTP:', res.statusCode);
    console.log('📦 Resposta:\n');

    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));

      if (json.suspenso) {
        console.log('\n✅ BLOQUEIO FUNCIONANDO!');
        console.log('   Suspenso até:', json.data_fim_formatada);
        console.log('   Dias restantes:', json.dias_restantes);
      } else {
        console.log('\n❌ PROBLEMA: Deveria estar suspenso mas retornou false!');
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro na requisição:', error.message);
});

req.write(postData);
req.end();
