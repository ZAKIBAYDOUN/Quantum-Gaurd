(function(){
  async function deploy(){
    if (!window.ethers || !window.provider) throw new Error('Conecta una wallet');
    const provider = new ethers.BrowserProvider(window.provider);
    const signer = await provider.getSigner();
    const abiText = document.getElementById('deploy-abi').value.trim();
    const bytecode = document.getElementById('deploy-bytecode').value.trim();
    const argsText = document.getElementById('deploy-args').value.trim();
    const abi = JSON.parse(abiText);
    const args = argsText ? JSON.parse(argsText) : [];
    const factory = new ethers.ContractFactory(abi, bytecode, signer);
    const contract = await factory.deploy(...args);
    const out = document.getElementById('deploy-output');
    out.textContent = `Tx: ${contract.deploymentTransaction().hash}`;
    const addr = await contract.getAddress();
    out.textContent += `\nAddress: ${addr}`;
  }
  function init(){ const btn = document.getElementById('btn-deploy'); if (btn) btn.onclick = ()=> deploy().catch(e=> alert(e.message||e)); }
  window.Deployer = { init, deploy };
})();
