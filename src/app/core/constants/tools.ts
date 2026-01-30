export enum ToolCategory {
  DISCOVERY = 'Discovery',
  WEB = 'Web',
  REVERSE_SHELL = 'Reverse Shell',
  EXPLOIT = 'Exploit',
  OTHER = 'Other'
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
    category: ToolCategory.DISCOVERY, 
    template: 'nmap -sV -p- {host}' 
  },
  { 
    id: 'ping', 
    name: 'Ping', 
    category: ToolCategory.DISCOVERY, 
    template: 'ping -c 4 {host}' 
  },
  { 
    id: 'whois', 
    name: 'Whois', 
    category: ToolCategory.DISCOVERY, 
    template: 'whois {host}' 
  },
  { 
    id: 'gobuster', 
    name: 'Gobuster Dir', 
    category: ToolCategory.WEB, 
    template: 'gobuster dir -u http://{host}:{port} -w common.txt' 
  },
  { 
    id: 'ffuf', 
    name: 'FFuF Fuzz', 
    category: ToolCategory.WEB, 
    template: 'ffuf -u http://{host}:{port}/FUZZ -w common.txt' 
  },
  { 
    id: 'nikto', 
    name: 'Nikto Scan', 
    category: ToolCategory.WEB, 
    template: 'nikto -h http://{host}:{port}' 
  },
  {
      id: 'netcat_rev',
      name: 'Netcat Listener',
      category: ToolCategory.REVERSE_SHELL,
      template: 'nc -lvnp {port}'
  }
];
