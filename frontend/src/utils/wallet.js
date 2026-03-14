/**
 * MetaMask wallet connection utilities
 */
import { ethers } from "ethers";

export const BASE_SEPOLIA_CHAIN_ID = "0x14a34"; // 84532

const BASE_SEPOLIA_CONFIG = {
  chainId: BASE_SEPOLIA_CHAIN_ID,
  chainName: "Base Sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://sepolia.base.org"],
  blockExplorerUrls: ["https://sepolia.basescan.org"],
};

/**
 * Connect to MetaMask and ensure we're on Base Sepolia.
 * Returns { address, provider, signer }
 */
export async function connectWallet() {
  if (typeof window.ethereum === "undefined") {
    // On mobile, offer to open MetaMask's in-app browser
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const currentUrl = encodeURIComponent(window.location.href);
      const openMetaMask = confirm(
        "No wallet detected.\n\nTo connect on mobile, open this site inside the MetaMask app's built-in browser.\n\nTap OK to open MetaMask."
      );
      if (openMetaMask) {
        window.location.href = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
      }
      throw new Error("Redirecting to MetaMask...");
    }
    throw new Error("No wallet detected. Please install a Web3 wallet (MetaMask, Coinbase Wallet, etc.) to leave reviews.");
  }

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const address = accounts[0];

  let provider = new ethers.BrowserProvider(window.ethereum);
  let signer = await provider.getSigner();

  // Check if we're on Base Sepolia
  const network = await provider.getNetwork();
  if (network.chainId !== 84532n) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [BASE_SEPOLIA_CONFIG],
        });
      } else {
        throw switchError;
      }
    }
    // Re-init after chain switch
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
  }

  return { address, provider, signer };
}
