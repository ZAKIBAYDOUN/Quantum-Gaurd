const files = [
  { path: 'dapp/index.html', label: 'index.html' },
  { path: 'dapp/app.js', label: 'app.js' },
  { path: 'dapp/wallets.js', label: 'wallets.js' },
  { path: 'dapp/mining.js', label: 'mining.js' },
  { path: 'dapp/qnn.js', label: 'qnn.js' },
  { path: 'dapp/mpc.js', label: 'mpc.js' },
  { path: 'dapp/ui.css', label: 'ui.css' }
];
const $ = (s)=>document.querySelector(s);

function renderExplorer(){
  const ex = $('#explorer');
  ex.innerHTML = '';
  for (const f of files){
    const a = document.createElement('div');
    a.className = 'item';
    a.textContent = f.label;
    a.addEventListener('click',()=>openFile(f.path));
    ex.appendChild(a);
  }
}

async function openFile(p){
  try{
    const res = await fetch('../'+p.replace(/^dapp\//,''));
    const text = await res.text();
    $('#viewer').textContent = text;
  }catch(e){
    $('#viewer').textContent = 'Error al cargar '+p+': '+(e.message||e);
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  renderExplorer();
  openFile(files[0].path);
});
