// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {QNNOracle} from "./QNNOracle.sol";

/**
 * @title CreditLineVault
 * @notice Pool simple: LPs depositan estable; usuarios abren línea si su score firmado supera el umbral.
 *         Interés por tier (A/B/C/D). Sin shares para simplificar; ideal como MVP.
 */
contract CreditLineVault is AccessControl {
    using SafeERC20 for IERC20;

    IERC20 public immutable stable;
    QNNOracle public immutable oracle;

    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    struct Line {
        uint256 limit;      // máximo utilizable
        uint256 debt;       // principal + interés acumulado
        uint64  lastAccrue; // timestamp última capitalización
        uint8   tier;       // 1=A,2=B,3=C,4=D
        bool    exists;
    }

    mapping(address => Line) public lines;
    uint256 public totalLiquidity;
    uint256 public totalDebt;

    // Interés anual (en bps), por tier. p.ej. 9% A, 12% B, 16% C, 25% D
    uint16[5] public aprBps = [0, 900, 1200, 1600, 2500];
    // Multiplicador de límite por tier (x ingreso base simulado): 4x, 3x, 2x, 1x
    uint16[5] public limitMult = [0, 400, 300, 200, 100];

    event Deposit(address indexed lp, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);
    event LineOpened(address indexed user, uint8 tier, uint256 limit);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);
    event Liquidate(address indexed user);

    constructor(IERC20 _stable, QNNOracle _oracle, address admin, address treasury) {
        stable = _stable;
        oracle = _oracle;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, treasury);
    }

    // ---------- Liquidez ----------
    function deposit(uint256 amount) external {
        require(amount > 0, "amount=0");
        stable.safeTransferFrom(msg.sender, address(this), amount);
        totalLiquidity += amount;
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount, address to) external onlyRole(TREASURY_ROLE) {
        require(amount <= stable.balanceOf(address(this)) - totalDebt, "insufficient free");
        stable.safeTransfer(to, amount);
        totalLiquidity -= amount;
        emit Withdraw(to, amount);
    }

    // ---------- Líneas de crédito ----------
    function _tierFromScore(uint256 score) internal pure returns (uint8) {
        if (score >= 900_000) return 1;
        if (score >= 850_000) return 2;
        if (score >= 750_000) return 3;
        return 4;
    }

    /// @notice Abre/renueva línea con score firmado por el oráculo.
    /// @param incomeHint número opcional para calcular límite (puede ser estimado por tu QNN/ML)
    function openOrUpdateLine(
        QNNOracle.Score calldata s,
        bytes[] calldata sigs,
        uint256 incomeHint
    ) external {
        require(s.sender == msg.sender, "bad sender");
        require(oracle.verifyScore(s, sigs), "bad score");
        uint8 tier = _tierFromScore(s.score);

        Line storage L = lines[msg.sender];
        if (!L.exists) {
            L.exists = true;
            L.lastAccrue = uint64(block.timestamp);
        } else {
            _accrue(msg.sender, L);
        }

        // Límite basado en multiplicador por tier (cap al 5% de liquidez total para MVP)
        uint256 maxByTier = (incomeHint * limitMult[tier]) / 100;
        uint256 cap = (totalLiquidity * 5) / 100;
        L.limit = maxByTier > cap ? cap : maxByTier;
        L.tier = tier;

        emit LineOpened(msg.sender, tier, L.limit);
    }

    function _accrue(address user, Line storage L) internal {
        if (L.debt == 0) { L.lastAccrue = uint64(block.timestamp); return; }
        uint256 dt = block.timestamp - L.lastAccrue;
        if (dt == 0) return;
        // interés simple prorrateado (ano = 365d)
        uint256 rateBps = aprBps[L.tier];
        uint256 interest = (L.debt * rateBps * dt) / (365 days * 10_000);
        L.debt += interest;
        totalDebt += interest;
        L.lastAccrue = uint64(block.timestamp);
    }

    function borrow(uint256 amount) external {
        Line storage L = lines[msg.sender];
        require(L.exists, "no line");
        _accrue(msg.sender, L);
        require(L.debt + amount <= L.limit, "limit");
        require(stable.balanceOf(address(this)) >= amount, "liquidity");
        L.debt += amount;
        totalDebt += amount;
        stable.safeTransfer(msg.sender, amount);
        emit Borrow(msg.sender, amount);
    }

    function repay(uint256 amount) external {
        Line storage L = lines[msg.sender];
        require(L.exists && L.debt > 0, "no debt");
        _accrue(msg.sender, L);
        if (amount > L.debt) amount = L.debt;
        stable.safeTransferFrom(msg.sender, address(this), amount);
        L.debt -= amount;
        totalDebt -= amount;
        emit Repay(msg.sender, amount);
    }

    // Liquidación "manual" (puedes conectar un bot): si deuda > 0 y tier D (alto riesgo) + 30 días sin pagar.
    function liquidate(address user) external onlyRole(TREASURY_ROLE) {
        Line storage L = lines[user];
        require(L.exists && L.debt > 0, "nothing");
        require(L.tier == 4, "not worst tier");
        require(block.timestamp > L.lastAccrue + 30 days, "grace");
        // MVP: "marca" como incobrable; en producción, usarías garantías, slashing, etc.
        totalDebt -= L.debt;
        L.debt = 0;
        emit Liquidate(user);
    }

    function getAccruedDebt(address user) external view returns (uint256) {
        Line memory L = lines[user];
        if (!L.exists || L.debt == 0) return 0;
        uint256 dt = block.timestamp - L.lastAccrue;
        uint256 interest = (L.debt * aprBps[L.tier] * dt) / (365 days * 10_000);
        return L.debt + interest;
    }
}