// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICaveatEnforcer
 * @notice Minimal interface for MetaMask Delegation Framework caveat enforcers.
 * @dev Based on the MetaMask Delegation Framework's CaveatEnforcer interface.
 *      Each hook receives the delegation terms (set by delegator) and args (provided
 *      by the redeemer at execution time). The enforcer validates conditions and
 *      reverts if the caveat is not satisfied.
 */
interface ICaveatEnforcer {
    /**
     * @notice Called before the delegated action executes.
     * @param terms  Encoded parameters set by the delegator (e.g., minimum trust score).
     * @param args   Encoded parameters provided by the redeemer (e.g., attestation UID).
     * @param mode   Execution mode identifier.
     * @param executionCallData  The calldata of the delegated execution.
     * @param delegationHash     Hash of the delegation being redeemed.
     */
    function beforeHook(
        bytes calldata terms,
        bytes calldata args,
        bytes32 mode,
        bytes calldata executionCallData,
        bytes32 delegationHash
    ) external;

    /**
     * @notice Called after the delegated action executes.
     * @param terms  Encoded parameters set by the delegator.
     * @param args   Encoded parameters provided by the redeemer.
     * @param mode   Execution mode identifier.
     * @param executionCallData  The calldata of the delegated execution.
     * @param delegationHash     Hash of the delegation being redeemed.
     */
    function afterHook(
        bytes calldata terms,
        bytes calldata args,
        bytes32 mode,
        bytes calldata executionCallData,
        bytes32 delegationHash
    ) external;
}
