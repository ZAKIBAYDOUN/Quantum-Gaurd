const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying 5470 Smart Contracts - World-Class Edition");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // 1. Deploy QNNOracle with initial validators
  console.log("\n📡 Deploying QNNOracle...");
  const QNNOracle = await hre.ethers.getContractFactory("QNNOracle");
  const validators = [deployer.address]; // In production, use multiple validators
  const oracle = await QNNOracle.deploy(
    "5470-QNN-Oracle",
    "1.0",
    deployer.address,
    validators
  );
  await oracle.deployed();
  console.log("✅ QNNOracle deployed to:", oracle.address);

  // 2. Deploy Mock Adapter for testing
  console.log("\n🔄 Deploying MockAdapter...");
  const MockAdapter = await hre.ethers.getContractFactory("MockAdapter");
  const adapter = await MockAdapter.deploy();
  await adapter.deployed();
  console.log("✅ MockAdapter deployed to:", adapter.address);

  // 3. Deploy IntentEscrow
  console.log("\n🛡️ Deploying IntentEscrow...");
  const IntentEscrow = await hre.ethers.getContractFactory("IntentEscrow");
  const escrow = await IntentEscrow.deploy(oracle.address, adapter.address);
  await escrow.deployed();
  console.log("✅ IntentEscrow deployed to:", escrow.address);

  // 4. Deploy Mock ZK Verifier
  console.log("\n🔐 Deploying MockVerifier...");
  const MockVerifier = await hre.ethers.getContractFactory("MockVerifier");
  const verifier = await MockVerifier.deploy();
  await verifier.deployed();
  console.log("✅ MockVerifier deployed to:", verifier.address);

  // 5. Deploy ZKVerifierGate
  console.log("\n🚪 Deploying ZKVerifierGate...");
  const ZKVerifierGate = await hre.ethers.getContractFactory("ZKVerifierGate");
  const zkGate = await ZKVerifierGate.deploy(verifier.address);
  await zkGate.deployed();
  console.log("✅ ZKVerifierGate deployed to:", zkGate.address);

  // 6. Deploy MPCSmartWallet
  console.log("\n💼 Deploying MPCSmartWallet...");
  const MPCSmartWallet = await hre.ethers.getContractFactory("MPCSmartWallet");
  // For demo, use deployer as both owners - in production use different keys
  const wallet = await MPCSmartWallet.deploy(
    deployer.address,
    deployer.address, 
    oracle.address
  );
  await wallet.deployed();
  console.log("✅ MPCSmartWallet deployed to:", wallet.address);

  // 7. Deploy ReputationSBT
  console.log("\n🏅 Deploying ReputationSBT...");
  const ReputationSBT = await hre.ethers.getContractFactory("ReputationSBT");
  const sbt = await ReputationSBT.deploy(deployer.address, oracle.address);
  await sbt.deployed();
  console.log("✅ ReputationSBT deployed to:", sbt.address);

  // 8. Deploy Mock USDC for CreditLineVault
  console.log("\n💰 Deploying MockERC20 (USDC)...");
  const MockERC20 = await hre.ethers.getContractFactory("MockAdapter"); // Reuse for simplicity
  const usdc = await MockERC20.deploy();
  await usdc.deployed();
  console.log("✅ MockUSDC deployed to:", usdc.address);

  // 9. Deploy CreditLineVault
  console.log("\n🏦 Deploying CreditLineVault...");
  const CreditLineVault = await hre.ethers.getContractFactory("CreditLineVault");
  const creditVault = await CreditLineVault.deploy(
    usdc.address,
    oracle.address,
    deployer.address,
    deployer.address
  );
  await creditVault.deployed();
  console.log("✅ CreditLineVault deployed to:", creditVault.address);

  // 10. Deploy DynamicFeeDiscount
  console.log("\n💸 Deploying DynamicFeeDiscount...");
  const DynamicFeeDiscount = await hre.ethers.getContractFactory("DynamicFeeDiscount");
  const feeDiscount = await DynamicFeeDiscount.deploy(deployer.address, sbt.address);
  await feeDiscount.deployed();
  console.log("✅ DynamicFeeDiscount deployed to:", feeDiscount.address);

  // 11. Deploy GasSponsorVault
  console.log("\n⛽ Deploying GasSponsorVault...");
  const GasSponsorVault = await hre.ethers.getContractFactory("GasSponsorVault");
  const gasSponsor = await GasSponsorVault.deploy(
    deployer.address,
    oracle.address,
    sbt.address
  );
  await gasSponsor.deployed();
  console.log("✅ GasSponsorVault deployed to:", gasSponsor.address);

  // Summary
  console.log("\n🎯 DEPLOYMENT COMPLETE - Contract Addresses:");
  console.log("==================================================");
  console.log("QNNOracle:         ", oracle.address);
  console.log("IntentEscrow:      ", escrow.address);
  console.log("ZKVerifierGate:    ", zkGate.address);
  console.log("MPCSmartWallet:    ", wallet.address);
  console.log("ReputationSBT:     ", sbt.address);
  console.log("CreditLineVault:   ", creditVault.address);
  console.log("DynamicFeeDiscount:", feeDiscount.address);
  console.log("GasSponsorVault:   ", gasSponsor.address);
  console.log("MockAdapter:       ", adapter.address);
  console.log("MockVerifier:      ", verifier.address);
  console.log("MockUSDC:          ", usdc.address);
  console.log("==================================================");

  // Create deployment info for frontend
  const deploymentInfo = {
    contracts: {
      QNNOracle: {
        address: oracle.address,
        abi: "QNNOracle"
      },
      IntentEscrow: {
        address: escrow.address,
        abi: "IntentEscrow"
      },
      ZKVerifierGate: {
        address: zkGate.address,
        abi: "ZKVerifierGate"
      },
      MPCSmartWallet: {
        address: wallet.address,
        abi: "MPCSmartWallet"
      },
      ReputationSBT: {
        address: sbt.address,
        abi: "ReputationSBT"
      },
      CreditLineVault: {
        address: creditVault.address,
        abi: "CreditLineVault"
      },
      DynamicFeeDiscount: {
        address: feeDiscount.address,
        abi: "DynamicFeeDiscount"
      },
      GasSponsorVault: {
        address: gasSponsor.address,
        abi: "GasSponsorVault"
      }
    },
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  // Save to file for frontend integration
  const fs = require('fs');
  fs.writeFileSync(
    './deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("📄 Deployment info saved to deployment.json");
  console.log("🚀 Ready for frontend integration!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });