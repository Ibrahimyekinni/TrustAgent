/**
 * deployTrustEnforcer.js
 *
 * Deploys the TrustEnforcer contract to Base Sepolia.
 * TrustEnforcer is a MetaMask Delegation Framework caveat enforcer that
 * gates delegations based on TrustAgent's on-chain trust scores (EAS attestations).
 *
 * Usage: npx hardhat run scripts/deployTrustEnforcer.js --network baseSepolia
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("");
  console.log("=== TrustEnforcer Deployment ===");
  console.log("");
  console.log("  Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("  Balance:", hre.ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.log("  ERROR: No ETH! Get testnet ETH from https://www.superchain.tools/faucet");
    process.exit(1);
  }

  console.log("");
  console.log("  Deploying TrustEnforcer...");

  const TrustEnforcer = await hre.ethers.getContractFactory("TrustEnforcer");
  const enforcer = await TrustEnforcer.deploy();
  await enforcer.waitForDeployment();

  const address = await enforcer.getAddress();

  console.log("");
  console.log("  === DEPLOYED ===");
  console.log("");
  console.log("  TrustEnforcer:", address);
  console.log("  BaseScan: https://sepolia.basescan.org/address/" + address);
  console.log("");
  console.log("  Add to your .env file:");
  console.log("    TRUST_ENFORCER_ADDRESS=" + address);
  console.log("");
}

main().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
