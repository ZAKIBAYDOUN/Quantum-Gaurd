// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReputationSBT} from "./ReputationSBT.sol";

/**
 * @title DynamicFeeDiscount
 * @notice Calcula una comisión efectiva según reputación (SBT) y volumen histórico.
 */
contract DynamicFeeDiscount is AccessControl {
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    ReputationSBT public immutable sbt;

    // baseFee en bps (p.ej. 30 = 0.30%)
    uint16 public baseFeeBps = 30;

    // descuentos por grade (A/B/C/D) en bps
    uint16[5] public gradeDiscount = [0, 15, 8, 3, 0]; // A: -0.15%, B: -0.08%, C: -0.03%, D: 0

    // volumen en ventana (off-chain feeding vía oráculo/cron)
    mapping(address => uint256) public volume30d;

    event Params(uint16 baseFee, uint16[5] gradeDisc);

    constructor(address admin, ReputationSBT _sbt) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPDATER_ROLE, admin);
        sbt = _sbt;
    }

    function setParams(uint16 _base, uint16[5] calldata disc) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseFeeBps = _base;
        gradeDiscount = disc;
        emit Params(_base, disc);
    }

    function pushVolume(address user, uint256 vol) external onlyRole(UPDATER_ROLE) {
        volume30d[user] = vol;
    }

    /// @return feeBps comisión efectiva para user
    function feeFor(address user) external view returns (uint16 feeBps) {
        uint8 g = sbt.gradeOf(user); // 0..4
        int256 base = int256(uint256(baseFeeBps));
        int256 disc = int256(uint256(gradeDiscount[g]));
        // bonus por volumen: si vol >= 100k, extra -2 bps; si >= 1M, -5 bps
        int256 vBonus = volume30d[user] >= 1_000_000 ether ? int256(5) : volume30d[user] >= 100_000 ether ? int256(2) : int256(0);
        int256 eff = base - disc - vBonus;
        if (eff < 0) eff = 0;
        if (eff > 10_000) eff = 10_000;
        feeBps = uint16(uint256(int256(eff)));
    }
}