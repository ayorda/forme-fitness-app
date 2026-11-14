const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const isTestFile=name=>name.endsWith('.test.js')||name==='test.js';

function workflowLists(){
 const workflow=fs.readFileSync('.github/workflows/final-check.yml','utf8');
 const run=workflow.match(/node --test ([^\n]+)/);
 assert.ok(run,'workflow runs node --test with an explicit file list');
 const tests=run[1].trim().split(/\s+/);
 const checked=[...workflow.matchAll(/node --check (\S+)/g)].map(m=>m[1]);
 return {tests,checked};
}

test('every test file is registered in the CI workflow and still exists',()=>{
 const {tests}=workflowLists();
 const files=fs.readdirSync('.').filter(isTestFile).sort();
 assert.ok(files.length>=15,'sanity: the repository keeps a healthy test suite');
 assert.deepEqual([...tests].sort(),files,
  'the node --test list in final-check.yml must exactly match the test files on disk');
});

test('the CI workflow parses every production JavaScript file',()=>{
 const {checked}=workflowLists();
 const files=fs.readdirSync('.')
  .filter(name=>name.endsWith('.js')&&!isTestFile(name)).concat(fs.readdirSync('vendor').filter(name=>name.endsWith('.js')).map(name=>'vendor/'+name)).sort();
 assert.ok(files.length>=15,'sanity: the repository keeps a production script set');
 assert.deepEqual([...checked].sort(),files,
  'the node --check list in final-check.yml must exactly match the production .js files on disk');
});

test('README states the exact number of automated tests',()=>{
 if(process.env.FORME_COUNT_RUN)return; // the nested counting run must not recurse
 const files=fs.readdirSync('.').filter(isTestFile).sort();
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
