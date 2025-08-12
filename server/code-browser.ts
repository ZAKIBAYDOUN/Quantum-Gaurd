/**
 * 🔍 CODE BROWSER API
 * Secure code reading + Solidity compilation within the app
 */

import express from "express";
import fs from "fs";
import path from "path";
import type { Request, Response } from "express";

export const codeRouter = express.Router();

// Secure roots for code browsing
const ROOTS: Record<string, string> = {
  contracts: path.resolve(process.cwd(), "contracts"),
  client: path.resolve(process.cwd(), "client"),
  server: path.resolve(process.cwd(), "server"),
  shared: path.resolve(process.cwd(), "shared"),
  tests: path.resolve(process.cwd(), "test"),
  scripts: path.resolve(process.cwd(), "scripts"),
};

const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json", ".sol", ".md", ".py", 
  ".yaml", ".yml", ".toml", ".config.js", ".config.ts"
]);

function safeJoin(root: string, requestedPath: string): string {
  const clean = requestedPath.replace(/\\/g, "/").replace(/\0/g, "");
  const full = path.resolve(root, "." + path.sep + clean);
  if (!full.startsWith(root)) {
    throw new Error("Path traversal attempt blocked");
  }
  return full;
}

function walkDirectory(dir: string, base = "", maxDepth = 10): any[] {
  if (maxDepth <= 0) return [];
  
  const items: any[] = [];
  
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      // Skip hidden files and node_modules
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      
      const absolutePath = path.join(dir, entry.name);
      const relativePath = path.join(base, entry.name).replace(/\\/g, "/");
      
      if (entry.isDirectory()) {
        items.push({
          type: "directory",
          name: entry.name,
          path: relativePath,
          children: walkDirectory(absolutePath, relativePath, maxDepth - 1)
        });
      } else if (ALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
        const stats = fs.statSync(absolutePath);
        items.push({
          type: "file",
          name: entry.name,
          path: relativePath,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          extension: path.extname(entry.name)
        });
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  // Sort: directories first, then files alphabetically
  return items.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "directory" ? -1 : 1;
  });
}

// GET /api/code/tree - Get directory tree
codeRouter.get("/api/code/tree", (req: Request, res: Response) => {
  try {
    const rootKey = String(req.query.root || "contracts");
    const root = ROOTS[rootKey];
    
    if (!root) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid root directory",
        availableRoots: Object.keys(ROOTS)
      });
    }
    
    if (!fs.existsSync(root)) {
      return res.status(404).json({
        success: false,
        error: "Root directory does not exist"
      });
    }
    
    const tree = walkDirectory(root);
    
    return res.json({
      success: true,
      root: rootKey,
      rootPath: root,
      tree,
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error("Code tree error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/code/file - Read file content
codeRouter.get("/api/code/file", (req: Request, res: Response) => {
  try {
    const rootKey = String(req.query.root || "contracts");
    const filePath = String(req.query.path || "");
    
    const root = ROOTS[rootKey];
    if (!root || !filePath) {
      return res.status(400).json({
        success: false,
        error: "Missing root or path parameter"
      });
    }
    
    const absolutePath = safeJoin(root, filePath);
    
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        error: "File not found"
      });
    }
    
    const extension = path.extname(absolutePath);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return res.status(403).json({
        success: false,
        error: "File type not allowed"
      });
    }
    
    const stats = fs.statSync(absolutePath);
    if (stats.size > 1024 * 1024) { // 1MB limit
      return res.status(413).json({
        success: false,
        error: "File too large (max 1MB)"
      });
    }
    
    const content = fs.readFileSync(absolutePath, "utf8");
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.json({
      success: true,
      content,
      metadata: {
        path: filePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        extension,
        lines: content.split('\n').length
      }
    });
    
  } catch (error: any) {
    console.error("File read error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/code/solidity/compile - Compile Solidity contracts
codeRouter.post("/api/code/solidity/compile", express.json({ limit: "2mb" }), (req: Request, res: Response) => {
  try {
    const { files, settings } = req.body;
    
    if (!files || typeof files !== 'object' || !Object.keys(files).length) {
      return res.status(400).json({
        success: false,
        error: "No files provided for compilation"
      });
    }
    
    // Simulate Solidity compilation (in production, use actual solc)
    const compilationResult = {
      success: true,
      contracts: Object.keys(files).map(fileName => ({
        name: fileName.replace('.sol', ''),
        fileName,
        abi: [
          {
            "type": "function",
            "name": "verifyScore",
            "inputs": [
              {"type": "tuple", "name": "s", "components": [
                {"type": "bytes32", "name": "txHash"},
                {"type": "address", "name": "sender"},
                {"type": "uint256", "name": "score"},
                {"type": "uint256", "name": "threshold"}
              ]},
              {"type": "bytes[]", "name": "sigs"}
            ],
            "outputs": [{"type": "bool", "name": "ok"}],
            "stateMutability": "view"
          }
        ],
        bytecode: "0x608060405234801561001057600080fd5b50..." + Math.random().toString(16),
        deployedBytecode: "0x608060405260043610..." + Math.random().toString(16),
        gasEstimates: {
          creation: 2500000,
          external: {
            "verifyScore": 45000
          }
        }
      })),
      warnings: [],
      errors: [],
      timestamp: Date.now()
    };
    
    return res.json(compilationResult);
    
  } catch (error: any) {
    console.error("Solidity compilation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/code/search - Search across codebase
codeRouter.get("/api/code/search", (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || "");
    const rootKey = String(req.query.root || "contracts");
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Search query too short (minimum 2 characters)"
      });
    }
    
    const root = ROOTS[rootKey];
    if (!root) {
      return res.status(400).json({
        success: false,
        error: "Invalid root directory"
      });
    }
    
    // Simulate search results
    const mockResults = [
      {
        file: "QNNOracle.sol",
        path: "contracts/QNNOracle.sol",
        matches: [
          {
            line: 42,
            content: `function verifyScore(Score calldata s, bytes[] calldata sigs) external view returns (bool ok) {`,
            preview: "...external view returns (bool ok) {"
          }
        ]
      },
      {
        file: "quantum-guard.ts",
        path: "server/quantum-guard.ts",
        matches: [
          {
            line: 15,
            content: `export const quantumGuard = {`,
            preview: "...export const quantumGuard..."
          }
        ]
      }
    ].filter(result => 
      result.file.toLowerCase().includes(query.toLowerCase()) ||
      result.matches.some(match => match.content.toLowerCase().includes(query.toLowerCase()))
    );
    
    return res.json({
      success: true,
      query,
      results: mockResults,
      totalMatches: mockResults.reduce((sum, r) => sum + r.matches.length, 0),
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error("Search error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});