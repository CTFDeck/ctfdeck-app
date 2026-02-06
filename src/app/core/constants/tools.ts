export enum ToolCategory {
  PORT_SCANNING = 'Port Scanning',
  WEB_DISCOVERY = 'Web Discovery',
  WEB_VULN_SCAN = 'Web Vulnerability Scan',
  REVERSE_SHELL = 'Reverse Shell',
  EXPLOIT = 'Exploit',
  OTHER = 'Other',
}

export interface Tool {
  id: string;
  name: string;
  category: ToolCategory;
  template: string;
}

export const TOOLS: Tool[] = [
  {
    id: 'nmap',
    name: 'Nmap Scan',
    category: ToolCategory.PORT_SCANNING,
    template: 'nmap -sV -p- {host}',
  },
  {
    id: 'ping',
    name: 'Ping',
    category: ToolCategory.OTHER,
    template: 'ping -c 4 {host}',
  },
  {
    id: 'whois',
    name: 'Whois',
    category: ToolCategory.OTHER,
    template: 'whois {host}',
  },
  {
    id: 'gobuster',
    name: 'Gobuster Dir',
    category: ToolCategory.WEB_DISCOVERY,
    template: 'gobuster dir -u http://{host}:{port} -w common.txt',
  },
  {
    id: 'ffuf',
    name: 'FFuF Fuzz',
    category: ToolCategory.WEB_DISCOVERY,
    template: 'ffuf -u http://{host}:{port}/FUZZ -w common.txt',
  },
  {
    id: 'nikto',
    name: 'Nikto Scan',
    category: ToolCategory.WEB_VULN_SCAN,
    template: 'nikto -h http://{host}:{port}',
  },
  {
    id: 'netcat_rev',
    name: 'Netcat Listener',
    category: ToolCategory.REVERSE_SHELL,
    template: 'nc -lvnp {port}',
  },
];
