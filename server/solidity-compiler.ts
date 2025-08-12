/**
 * 🔧 SOLIDITY COMPILER SERVICE
 * Full Solidity compilation with optimization and error handling
 */

import express from "express";
import solc from "solc";
import type { Request, Response } from "express";

export const solidityRouter = express.Router();

interface CompileRequest {
  files: Record<string, string>;
  settings?: {
    optimizer?: {
      enabled: boolean;
      runs: number;
    };
    evmVersion?: string;
    outputSelection?: any;
  };
}

interface CompileResponse {
  ok: boolean;
  output?: any;
  contracts?: Record<string, any>;
  errors?: string[];
  warnings?: string[];
}

// POST /api/solidity/compile - Compile Solidity sources
solidityRouter.post("/api/solidity/compile", express.json({ limit: "5mb" }), async (req: Request, res: Response) => {
  try {
    const { files, settings }: CompileRequest = req.body;

    if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No files provided for compilation"
      } as CompileResponse);
    }

    // Default compilation settings
    const defaultSettings = {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "london",
      outputSelection: {
        "*": {
          "*": [
            "abi",
            "evm.bytecode",
            "evm.deployedBytecode",
            "evm.gasEstimates",
            "metadata"
          ]
        }
      }
    };

    const compilerSettings = { ...defaultSettings, ...settings };

    // Create compilation input
    const input = {
      language: "Solidity",
      sources: Object.fromEntries(
        Object.entries(files).map(([filename, content]) => [
          filename,
          { content }
        ])
      ),
      settings: compilerSettings
    };

    // Import callback for external files (OpenZeppelin, etc.)
    const findImports = (importPath: string): { error?: string; contents?: string } => {
      // Handle common OpenZeppelin imports
      if (importPath.startsWith("@openzeppelin/")) {
        // In a real implementation, you'd fetch from npm or a CDN
        // For now, return a basic import structure
        return {
          contents: `
            // Mock OpenZeppelin import: ${importPath}
            // In production, this would fetch the actual contract
            pragma solidity ^0.8.0;
            contract MockImport {}
          `
        };
      }
      
      // Handle relative imports within the project
      if (files[importPath]) {
        return { contents: files[importPath] };
      }

      return { error: `File not found: ${importPath}` };
    };

    // Compile
    const output = JSON.parse(
      solc.compile(JSON.stringify(input), { import: findImports })
    );

    // Process compilation results
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (output.errors) {
      for (const error of output.errors) {
        if (error.severity === "error") {
          errors.push(error.formattedMessage || error.message);
        } else {
          warnings.push(error.formattedMessage || error.message);
        }
      }
    }

    // If there are compilation errors, return them
    if (errors.length > 0) {
      return res.json({
        ok: false,
        output,
        errors,
        warnings
      } as CompileResponse);
    }

    // Extract contracts with simplified structure
    const contracts: Record<string, any> = {};
    
    if (output.contracts) {
      for (const [filename, fileContracts] of Object.entries(output.contracts)) {
        contracts[filename] = {};
        
        for (const [contractName, contractData] of Object.entries(fileContracts as Record<string, any>)) {
          contracts[filename][contractName] = {
            abi: contractData.abi,
            bytecode: contractData.evm?.bytecode?.object || "",
            deployedBytecode: contractData.evm?.deployedBytecode?.object || "",
            gasEstimates: contractData.evm?.gasEstimates || {},
            metadata: contractData.metadata ? JSON.parse(contractData.metadata) : {}
          };
        }
      }
    }

    const response: CompileResponse = {
      ok: true,
      output,
      contracts,
      errors,
      warnings
    };

    res.json(response);

  } catch (error: any) {
    console.error("Solidity compilation error:", error);
    
    res.status(500).json({
      ok: false,
      error: error?.message || String(error)
    } as CompileResponse);
  }
});

// GET /api/solidity/version - Get compiler version
solidityRouter.get("/api/solidity/version", (req: Request, res: Response) => {
  res.json({
    ok: true,
    version: solc.version(),
    longVersion: "unknown"
  });
});

// POST /api/solidity/validate - Validate Solidity syntax without compilation
solidityRouter.post("/api/solidity/validate", express.json(), async (req: Request, res: Response) => {
  try {
    const { source }: { source: string } = req.body;
    
    if (!source) {
      return res.status(400).json({ ok: false, error: "No source code provided" });
    }

    // Basic syntax validation using regex patterns
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for basic Solidity syntax
    if (!source.includes("pragma solidity")) {
      warnings.push("Missing pragma solidity directive");
    }

    if (!source.includes("contract ") && !source.includes("library ") && !source.includes("interface ")) {
      errors.push("No contract, library, or interface definition found");
    }

    // Check for balanced braces
    const openBraces = (source.match(/{/g) || []).length;
    const closeBraces = (source.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push("Unbalanced braces");
    }

    res.json({
      ok: errors.length === 0,
      errors,
      warnings,
      hasContracts: source.includes("contract "),
      hasLibraries: source.includes("library "),
      hasInterfaces: source.includes("interface ")
    });

  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || String(error)
    });
  }
});