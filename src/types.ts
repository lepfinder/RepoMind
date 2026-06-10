export interface Project {
  name: string;
  owner: string;
  repo: string;
  description: string;
  remoteUrl: string;
  githubUrl: string;
  language: string;
  topics: string[];
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitDate: string;
  path: string;
  scannedAt: string;
  createdAt: string;

  // GitHub stats & Version diffs
  stars: number;
  forks: number;
  remoteCommitHash: string;
  remoteCommitDate: string;
  compareStatus: string;
  aheadBy: number;
  behindBy: number;
}

export interface AnalysisDetail {
  project_id: number;
  project_name?: string;
  answer: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isComplete?: boolean;
  sessionId?: number;
  analyses?: AnalysisDetail[];
}

export interface Workspace {
  id: number;
  name: string;
  description: string;
  projects: Project[];
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}


