// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPlonkVerifier {
    function verifyProof(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool);
}

/// @notice Puerta de verificación ZK: aplica política "no proof, no party".
contract ZKVerifierGate {
    IPlonkVerifier public immutable verifier;
    event Verified(address indexed user, bytes32 tag);

    constructor(IPlonkVerifier _verifier) {
        verifier = _verifier;
    }

    /// @param tag etiqueta de política (ej. "TRANSFER_PRIV", "KYC18")
    function requireProof(bytes calldata proof, uint256[] calldata pubInputs, bytes32 tag) public view {
        require(verifier.verifyProof(proof, pubInputs), "invalid zk");
        // si necesitas binding a msg.sender, incluye su hash en pubInputs
    }

    /// ejemplo: hook que una dApp puede llamar antes de ejecutar una acción privada
    function attest(bytes calldata proof, uint256[] calldata pubInputs, bytes32 tag) external {
        requireProof(proof, pubInputs, tag);
        emit Verified(msg.sender, tag);
    }
}