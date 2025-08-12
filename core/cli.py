#!/usr/bin/env python3
"""
5470 Core CLI - Command Line Interface
Similar to bitcoin-cli for interacting with the node
"""

import argparse
import json
import requests
import sys
from typing import Optional

class CoreCLI:
    """5470 Core Command Line Interface"""
    
    def __init__(self, host: str = "127.0.0.1", port: int = 8332):
        self.rpc_url = f"http://{host}:{port}/"
        self.request_id = 1
    
    def call_rpc(self, method: str, params: list = None) -> Optional[dict]:
        """Make RPC call to the node"""
        if params is None:
            params = []
        
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": self.request_id
        }
        
        try:
            response = requests.post(
                self.rpc_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('error'):
                    print(f"Error: {result['error']['message']}")
                    return None
                return result.get('result')
            else:
                print(f"HTTP Error {response.status_code}: {response.text}")
                return None
                
        except requests.exceptions.ConnectionError:
            print("Error: Could not connect to 5470 Core node. Is it running?")
            return None
        except Exception as e:
            print(f"Error: {e}")
            return None
    
    def getinfo(self):
        """Get general information about the node"""
        result = self.call_rpc("getinfo")
        if result:
            print(json.dumps(result, indent=2))
    
    def getblockcount(self):
        """Get the number of blocks in the blockchain"""
        result = self.call_rpc("getblockcount")
        if result is not None:
            print(f"Block count: {result}")
    
    def getbalance(self, address: str = None):
        """Get wallet balance"""
        params = [address] if address else []
        result = self.call_rpc("getbalance", params)
        if result is not None:
            print(f"Balance: {result:.8f} 5470")
    
    def sendtoaddress(self, address: str, amount: float):
        """Send coins to an address"""
        result = self.call_rpc("sendtoaddress", [address, amount])
        if result:
            print(f"Transaction sent: {result}")
    
    def getmempoolinfo(self):
        """Get mempool information"""
        result = self.call_rpc("getmempoolinfo")
        if result:
            print(json.dumps(result, indent=2))
    
    def getpeerinfo(self):
        """Get information about connected peers"""
        result = self.call_rpc("getpeerinfo")
        if result:
            print(f"Connected peers: {len(result)}")
            for peer in result:
                print(f"  {peer['addr']}")
    
    def generate(self, blocks: int):
        """Generate blocks (mining for testing)"""
        result = self.call_rpc("generate", [blocks])
        if result:
            print(f"Generated {len(result)} blocks:")
            for block_hash in result:
                print(f"  {block_hash}")
    
    def startmining(self):
        """Start mining"""
        result = self.call_rpc("startmining")
        if result:
            print(result['status'])
    
    def stopmining(self):
        """Stop mining"""
        result = self.call_rpc("stopmining")
        if result:
            print(result['status'])
    
    def getmininginfo(self):
        """Get mining information"""
        result = self.call_rpc("getmininginfo")
        if result:
            print(json.dumps(result, indent=2))

def main():
    parser = argparse.ArgumentParser(description='5470 Core CLI')
    parser.add_argument('--host', default='127.0.0.1', help='RPC host')
    parser.add_argument('--port', type=int, default=8332, help='RPC port')
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Add subcommands
    subparsers.add_parser('getinfo', help='Get node information')
    subparsers.add_parser('getblockcount', help='Get block count')
    
    balance_parser = subparsers.add_parser('getbalance', help='Get balance')
    balance_parser.add_argument('address', nargs='?', help='Address (optional)')
    
    send_parser = subparsers.add_parser('sendtoaddress', help='Send coins')
    send_parser.add_argument('address', help='Recipient address')
    send_parser.add_argument('amount', type=float, help='Amount to send')
    
    subparsers.add_parser('getmempoolinfo', help='Get mempool info')
    subparsers.add_parser('getpeerinfo', help='Get peer info')
    
    generate_parser = subparsers.add_parser('generate', help='Generate blocks')
    generate_parser.add_argument('blocks', type=int, help='Number of blocks to generate')
    
    subparsers.add_parser('startmining', help='Start mining')
    subparsers.add_parser('stopmining', help='Stop mining')
    subparsers.add_parser('getmininginfo', help='Get mining info')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    cli = CoreCLI(args.host, args.port)
    
    # Execute command
    if args.command == 'getinfo':
        cli.getinfo()
    elif args.command == 'getblockcount':
        cli.getblockcount()
    elif args.command == 'getbalance':
        cli.getbalance(getattr(args, 'address', None))
    elif args.command == 'sendtoaddress':
        cli.sendtoaddress(args.address, args.amount)
    elif args.command == 'getmempoolinfo':
        cli.getmempoolinfo()
    elif args.command == 'getpeerinfo':
        cli.getpeerinfo()
    elif args.command == 'generate':
        cli.generate(args.blocks)
    elif args.command == 'startmining':
        cli.startmining()
    elif args.command == 'stopmining':
        cli.stopmining()
    elif args.command == 'getmininginfo':
        cli.getmininginfo()

if __name__ == '__main__':
    main()