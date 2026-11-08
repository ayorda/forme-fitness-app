const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

test('every test file is registered in the CI workflow and still exists',()=>{
 const workflow=fs.readFileSync('.github/workflows/final-check.yml','utf8');
 const files=fs.readdirSync('.').filter(name=>name.endsWith('.test.js')).sort();
 assert.ok(files.length>=15,'sanity: the repository keeps a healthy test suite');
 for(const file of files)
  assert.ok(workflow.includes(file),`${file} is not listed in .github/workflows/final-check.yml`);
 const listed=[...workflow.matchAll(/\b([a-z0-9-]+\.test\.js)\b/g)].map(m=>m[1]);
 for(const file of listed)
  assert.ok(files.includes(file),`final-check.yml lists a test file that no longer exists: ${file}`);
});

test('README states the exact number of automated tests',()=>{
 if(process.env.FORME_COUNT_RUN)return; // the nested counting run must not recurse
 const files=fs.readdirSync('.').filter(name=>name.endsWith('.test.js')).sort();
 const env={...process.env,FORME_COUNT_RUN:'1'};
 delete env.NODE_TEST_CONTEXT; // the outer runner's context must not reach the child
 let output;
 try{
  output=execFileSync(process.execPath,['--test','--test-reporter=tap',...files],{
   encoding:'utf8',timeout:180000,maxBuffer:10*1024*1024,env
  });
 }catch(error){
  assert.fail(`nested test run failed:\n${String(error.stdout||'').slice(-2000)}`);
 }
 const summary=output.match(/^# tests (\d+)$/m);
 assert.ok(summary,'nested test run reports its total');
 const actual=Number(summary[1]);
 const readme=fs.readFileSync('README.md','utf8');
 const declared=new Set();
 for(const m of readme.matchAll(/Проверки:\*\* (\d+) автоматични теста/g))declared.add(Number(m[1]));
 for(const m of readme.matchAll(/\*\*(\d+)\*\* автоматични теста/g))declared.add(Number(m[1]));
 assert.ok(declared.size>0,'README declares its test count');
 assert.deepEqual([...declared],[actual],`README test count must match the real suite (${actual})`);
});
