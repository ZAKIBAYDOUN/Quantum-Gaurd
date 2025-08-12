// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title QNNOracle
 * @notice Oracle de riesgo tipo EIP-712 (2-de-N firmas). Datos off-chain, verificación on-chain.
 * @dev Los consumidores NO necesitan storage; verifican firma y umbral en la llamada.
 */
contract QNNOracle is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant SCORE_TYPEHASH =
        keccak256("RiskScore(bytes32 txHash,address sender,uint256 score,uint256 threshold,uint256 nonce,uint256 deadline)");

    uint256 public minSignatures = 2; // 2-de-N

    mapping(address => uint256) public nonces; // por emisor (opcional)
    mapping(address => bool) public isValidator;

    event ValidatorAdded(address indexed v);
    event ValidatorRemoved(address indexed v);
    event MinSignatures(uint256 m);

    constructor(string memory name, string memory version, address admin, address[] memory initialValidators) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        for (uint256 i; i < initialValidators.length; i++) {
            isValidator[initialValidators[i]] = true;
            emit ValidatorAdded(initialValidators[i]);
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                address(this)
            )
        );
    }

    function setMinSignatures(uint256 m) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(m >= 1, "min >= 1");
        minSignatures = m;
        emit MinSignatures(m);
    }

    function addValidator(address v) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isValidator[v], "exists");
        isValidator[v] = true;
        emit ValidatorAdded(v);
    }

    function removeValidator(address v) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isValidator[v], "none");
        isValidator[v] = false;
        emit ValidatorRemoved(v);
    }

    struct Score {
        bytes32 txHash;
        address sender;
        uint256 score;     // 0..1e6 (p.ej. 0.87 => 870000)
        uint256 threshold; // 0..1e6
        uint256 nonce;     // opcional
        uint256 deadline;  // unix
    }

    /**
     * @notice Verifica conjunto de firmas sobre un Score. No escribe en storage.
     * @return ok si hay m firmas válidas y score >= threshold.
     */
    function verifyScore(Score calldata s, bytes[] calldata sigs) external view returns (bool ok) {
        require(s.deadline == 0 || block.timestamp <= s.deadline, "expired");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(SCORE_TYPEHASH, s.txHash, s.sender, s.score, s.threshold, s.nonce, s.deadline))
            )
        );
        uint256 count;
        address last = address(0);

        for (uint256 i; i < sigs.length; i++) {
            address r = digest.recover(sigs[i]);
            if (r > last && isValidator[r]) { // evita firmas duplicadas / ordenadas
                last = r;
                count++;
            }
        }
        ok = (count >= minSignatures) && (s.score >= s.threshold);
    }
}