export const TOOL_TEMPLATES: Record<string, string> = {
  nmap: 'nmap -sV -p- {host}',
  ping: 'ping -c 4 {host}',
  whois: 'whois {host}',
  gobuster: 'gobuster dir -u http://{host}:{port} -w common.txt',
  ffuf: 'ffuf -u http://{host}:{port}/FUZZ -w common.txt',
  nikto: 'nikto -h http://{host}:{port}',
  netcat: 'nc -lvnp {port}',
};
